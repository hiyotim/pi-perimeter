/*
 * pi-warden native helper.
 *
 * Deliberately narrow mechanisms, and nothing else:
 *
 *   launch  Constructs the child descriptor envelope (closing every
 *           descriptor above stdio, including high-numbered ones), then
 *           execs /usr/bin/sandbox-exec with the generated profile. The
 *           profile is therefore parsed by a process that holds no inherited
 *           descriptor, and the contained process starts with exactly
 *           stdio.
 *
 *   export  Performs one host effect for one export step, relative to a
 *           directory descriptor received from the trusted parent:
 *           descriptor-relative, one-component traversal with an identity
 *           check per component, the verified parent descriptor held through
 *           the effect, and exactly one of create/mkdir/replace. There is no
 *           delete, no rename, no multi-component path resolution, no policy
 *           decision, and no network or process operation.
 *
 *   freeze  Copies the projection into the frozen export source with
 *           descriptor-bound access at every step: the trusted parent passes
 *           two verified directory descriptors (the projection root and the
 *           frozen target root), and every name lookup during the copy is a
 *           single component resolved against a held directory descriptor.
 *           Directory descent opens with O_NOFOLLOW (a directory that was
 *           swapped for a symlink is refused, never followed), every opened
 *           object is identity-checked against the directory-entry
 *           measurement taken immediately before the open, and every regular
 *           file is re-checked (identity, link count, size, modification
 *           time) after its bytes are read. Nothing here resolves a
 *           multi-component path, follows a symlink, or decides policy.
 *
 *   measure Prints a descriptor-bound metadata walk of the projection for the
 *           host's quiescence measurement. The trusted parent passes one
 *           identity-verified directory descriptor (the projection root);
 *           enumeration and every name lookup are single components resolved
 *           against held directory descriptors, symlink entries contribute
 *           only their link text (never followed), and directory descent
 *           opens with O_NOFOLLOW so a swapped component is refused at access
 *           time instead of redirecting the walk. No policy decision, no byte
 *           copy, and no process operation.
 *
 *   census  Prints one process-table sample for the host's quiescence
 *           classification. The helper makes no kill or attribution decision
 *           itself.
 *
 * The helper never decides whether an effect is authorized. It validates
 * protocol fields exactly and refuses anything it cannot bind.
 *
 * Protocol (line based on stdin, UTF-8, LF terminated), modes export/freeze/
 * measure:
 *   PROTOCOL 2
 *   ... mode-specific fields (see the command implementations)
 *
 * On success: one RESULT line on stdout (measure: preceded by ENTRY lines),
 * exit 0.
 * On refusal: one REFUSE line on stderr, exit 2 (effect refusal) or
 * 3 (protocol refusal).
 */

#define _DARWIN_C_SOURCE 1

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <libproc.h>
#include <inttypes.h>
#include <limits.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/sysctl.h>
#include <sys/proc.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define HELPER_VERSION "1"
#define PROTOCOL_VERSION 2
#define MAX_COMPONENTS 64
#define MAX_LINE_BYTES 4096
#define MAX_NAME_BYTES 255
#define MAX_PAYLOAD_BYTES ((uint64_t)64 * 1024 * 1024)
#define FD_SCAN_CAP ((uint64_t)1 << 20)
#define SANDBOX_EXEC_PATH "/usr/bin/sandbox-exec"
#define READ_BUFFER_BYTES 65536
#define MAX_FREEZE_ENTRIES ((uint64_t)200000)
#define MAX_FREEZE_FILE_BYTES ((uint64_t)256 * 1024 * 1024)
#define MAX_FREEZE_TOTAL_BYTES ((uint64_t)2 * 1024 * 1024 * 1024)
#define MAX_FREEZE_DEPTH 64
#define MAX_LINK_BYTES 1024

static const char *g_operation = "?";

static void refuse(int exit_code, const char *format, ...) {
  char message[512];
  va_list args;
  va_start(args, format);
  vsnprintf(message, sizeof(message), format, args);
  va_end(args);
  fprintf(stderr, "REFUSE %s :: %s\n", g_operation, message);
  fflush(stderr);
  exit(exit_code);
}

static void fail_errno(int exit_code, const char *format, ...) {
  char message[512];
  va_list args;
  va_start(args, format);
  vsnprintf(message, sizeof(message), format, args);
  va_end(args);
  refuse(exit_code, "%s: %s (errno=%d)", message, strerror(errno), errno);
}

/* ---------------------------------------------------------------- input -- */

static unsigned char g_read_buffer[READ_BUFFER_BYTES];
static size_t g_read_position = 0;
static size_t g_read_length = 0;

static int buffer_refill(void) {
  for (;;) {
    ssize_t got = read(STDIN_FILENO, g_read_buffer, sizeof(g_read_buffer));
    if (got < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    g_read_length = (size_t)got;
    g_read_position = 0;
    return 0;
  }
}

static int buffer_byte(void) {
  if (g_read_position >= g_read_length) {
    if (buffer_refill() != 0) return -1;
    if (g_read_length == 0) return -1;
  }
  return (int)g_read_buffer[g_read_position++];
}

static void read_exact(unsigned char *destination, size_t length) {
  size_t written = 0;
  while (written < length) {
    if (g_read_position < g_read_length) {
      size_t available = g_read_length - g_read_position;
      size_t take = available < (length - written) ? available : (length - written);
      memcpy(destination + written, g_read_buffer + g_read_position, take);
      g_read_position += take;
      written += take;
      continue;
    }
    if (buffer_refill() != 0) fail_errno(3, "payload read failed");
    if (g_read_length == 0) refuse(3, "payload shorter than declared size");
  }
}

/* Reads one protocol line (without the trailing LF) into the fixed buffer. */
static void read_line(char *out, size_t capacity) {
  size_t used = 0;
  for (;;) {
    int character = buffer_byte();
    if (character < 0) {
      if (used == 0) refuse(3, "unexpected end of protocol input");
      refuse(3, "protocol line is not terminated");
    }
    if (character == '\n') break;
    if (character == '\r') continue;
    if (used + 1 >= capacity) refuse(3, "protocol line too long");
    out[used++] = (char)character;
  }
  out[used] = '\0';
}

static void expect_keyword(const char *line, const char *keyword) {
  size_t length = strlen(keyword);
  if (strncmp(line, keyword, length) != 0) refuse(3, "expected %s, got a different field", keyword);
  if (line[length] != ' ') refuse(3, "malformed %s field (missing value)", keyword);
}

static uint64_t parse_u64(const char *text, const char *what) {
  if (text == NULL || *text == '\0') refuse(3, "%s must be an unsigned integer", what);
  uint64_t value = 0;
  for (const char *cursor = text; *cursor != '\0'; cursor++) {
    if (*cursor < '0' || *cursor > '9') refuse(3, "%s must be a plain unsigned integer", what);
    uint64_t digit = (uint64_t)(*cursor - '0');
    if (value > (UINT64_MAX - digit) / 10) refuse(3, "%s is out of range", what);
    value = value * 10 + digit;
  }
  return value;
}

static void validate_name(const char *name) {
  if (name == NULL || *name == '\0') refuse(3, "leaf/component name must not be empty");
  size_t length = strlen(name);
  if (length > MAX_NAME_BYTES) refuse(3, "name exceeds NAME_MAX");
  if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) refuse(3, "'.' and '..' names are refused");
  for (const char *cursor = name; *cursor != '\0'; cursor++) {
    unsigned char byte = (unsigned char)*cursor;
    if (byte == '/' || byte == 0) refuse(3, "name must not contain a path separator");
    if (byte < 0x20 || byte == 0x7f) refuse(3, "name must not contain control characters");
  }
}

/* -------------------------------------------------------------- identity -- */

static uint64_t stat_device(const struct stat *status) {
  return (uint64_t)status->st_dev;
}

static uint64_t stat_inode(const struct stat *status) {
  return (uint64_t)status->st_ino;
}

/* ---------------------------------------------------------------- launch -- */

static uint64_t descriptor_scan_limit(void) {
  struct rlimit limit;
  if (getrlimit(RLIMIT_NOFILE, &limit) != 0) return 1024;
  uint64_t value = (uint64_t)limit.rlim_cur;
  if (limit.rlim_cur == RLIM_INFINITY || value == 0 || value > FD_SCAN_CAP) return FD_SCAN_CAP;
  return value;
}

#define FD_LIST_CAPACITY 4096

static void close_descriptor(int fd) {
  while (close(fd) != 0) {
    if (errno != EINTR) break;
  }
}

static int descriptor_is_open(int fd) {
  errno = 0;
  if (fcntl(fd, F_GETFD) != -1) return 1;
  return errno != EBADF;
}

/*
 * Enumerates this process's open descriptors from the kernel. Returns the
 * exact count, -1 when the enumeration is unavailable, or -2 when the list
 * exceeds the caller's capacity (a truncated list is never acted on).
 */
static int list_open_descriptors(int *out, int capacity) {
  size_t size = 1024;
  struct proc_fdinfo *buffer = malloc(size);
  if (buffer == NULL) return -1;
  for (;;) {
    int got = proc_pidinfo(getpid(), PROC_PIDLISTFDS, 0, buffer, (int)size);
    if (got <= 0) {
      free(buffer);
      return -1;
    }
    if ((size_t)got < size) {
      int count = got / (int)sizeof(struct proc_fdinfo);
      if (count > capacity) {
        free(buffer);
        return -2;
      }
      for (int index = 0; index < count; index++) out[index] = buffer[index].proc_fd;
      free(buffer);
      return count;
    }
    size *= 2;
    struct proc_fdinfo *grown = realloc(buffer, size);
    if (grown == NULL) {
      free(buffer);
      return -1;
    }
    buffer = grown;
  }
}

static void scan_and_close_all(void) {
  /* Fallback path: linear scan to the descriptor limit, then verification. */
  uint64_t limit = descriptor_scan_limit();
  for (uint64_t fd = 3; fd < limit; fd++) close_descriptor((int)fd);
  for (uint64_t fd = 3; fd < limit; fd++) {
    if (descriptor_is_open((int)fd)) {
      close_descriptor((int)fd);
      if (descriptor_is_open((int)fd)) {
        refuse(4, "descriptor %" PRIu64 " could not be closed", fd);
      }
    }
  }
}

/*
 * Closes every descriptor above stdio, including high-numbered descriptors,
 * and verifies the result by re-enumerating. Any descriptor that survives is
 * fatal: the launch refuses rather than exposing an inherited descriptor to
 * the contained process.
 */
static void close_inherited_descriptors(void) {
  int descriptors[FD_LIST_CAPACITY];
  int count = list_open_descriptors(descriptors, FD_LIST_CAPACITY);
  if (count < 0) {
    scan_and_close_all();
    return;
  }
  for (int index = 0; index < count; index++) {
    if (descriptors[index] > STDERR_FILENO) close_descriptor(descriptors[index]);
  }
  count = list_open_descriptors(descriptors, FD_LIST_CAPACITY);
  if (count < 0) {
    scan_and_close_all();
    return;
  }
  for (int index = 0; index < count; index++) {
    if (descriptors[index] > STDERR_FILENO) {
      refuse(4, "descriptor %d survived the descriptor envelope", descriptors[index]);
    }
  }
}

static int command_launch(int argc, char **argv) {
  const char *profile = NULL;
  int index = 2;
  for (; index < argc; index++) {
    if (strcmp(argv[index], "--") == 0) {
      index++;
      break;
    }
    if (strcmp(argv[index], "--profile") == 0 && index + 1 < argc) {
      profile = argv[index + 1];
      index++;
      continue;
    }
    refuse(1, "unsupported launch argument");
  }
  if (profile == NULL || profile[0] != '/') refuse(1, "launch requires an absolute --profile path");
  if (index >= argc) refuse(1, "launch requires a shell path and arguments");
  const char *shell = argv[index];
  if (shell[0] != '/') refuse(1, "launch requires an absolute shell path");

  char *sandbox_argv[argc + 8];
  int out = 0;
  sandbox_argv[out++] = (char *)SANDBOX_EXEC_PATH;
  sandbox_argv[out++] = (char *)"-f";
  sandbox_argv[out++] = (char *)profile;
  for (int position = index; position < argc; position++) sandbox_argv[out++] = argv[position];
  sandbox_argv[out] = NULL;

  close_inherited_descriptors();
  execv(SANDBOX_EXEC_PATH, sandbox_argv);
  /* execv only returns on failure; report it after the envelope is closed. */
  refuse(5, "exec of %s failed: %s", SANDBOX_EXEC_PATH, strerror(errno));
  return 1;
}

static int command_selftest(void) {
  printf("HELPER %s\n", HELPER_VERSION);
  printf("PROTOCOL %d\n", PROTOCOL_VERSION);
#if defined(__arm64__) || defined(__aarch64__)
  printf("ARCH arm64\n");
#elif defined(__x86_64__)
  printf("ARCH x86_64\n");
#else
  printf("ARCH unknown\n");
#endif
  printf("CLOSE_SCAN_LIMIT %" PRIu64 "\n", descriptor_scan_limit());
  printf("MAX_PAYLOAD %" PRIu64 "\n", MAX_PAYLOAD_BYTES);
  printf("FREEZE_MAX_ENTRIES %" PRIu64 "\n", MAX_FREEZE_ENTRIES);
  printf("FREEZE_MAX_FILE_BYTES %" PRIu64 "\n", MAX_FREEZE_FILE_BYTES);
  printf("FREEZE_MAX_TOTAL_BYTES %" PRIu64 "\n", MAX_FREEZE_TOTAL_BYTES);
  printf("FREEZE_MAX_DEPTH %d\n", MAX_FREEZE_DEPTH);
  return 0;
}

/* ---------------------------------------------------------------- export -- */

struct component {
  uint64_t device;
  uint64_t inode;
  char name[MAX_NAME_BYTES + 1];
};

static void write_all(int fd, const unsigned char *bytes, size_t length) {
  size_t written = 0;
  while (written < length) {
    ssize_t result = write(fd, bytes + written, length - written);
    if (result < 0) {
      if (errno == EINTR) continue;
      fail_errno(2, "payload write failed");
    }
    written += (size_t)result;
  }
}

/*
 * The payload is read in full before any host object is touched: a short or
 * failed read therefore refuses the whole effect instead of leaving a
 * truncated existing file or a partial new one. The bound is MAX_PAYLOAD_BYTES.
 */
static unsigned char *receive_payload(uint64_t length) {
  unsigned char *payload = malloc(length == 0 ? 1 : (size_t)length);
  if (payload == NULL) refuse(3, "payload buffer could not be allocated");
  read_exact(payload, (size_t)length);
  return payload;
}

static void report_result(
    const char *op,
    const char *name,
    const struct stat *status,
    const char *extra_format,
    uint64_t extra_value) {
  if (extra_format != NULL) {
    printf(
        "RESULT %s %s dev=%" PRIu64 " ino=%" PRIu64 " nlink=%" PRIu64 " size=%" PRIu64 " %s=%" PRIu64 "\n",
        op,
        name,
        stat_device(status),
        stat_inode(status),
        (uint64_t)status->st_nlink,
        (uint64_t)status->st_size,
        extra_format,
        extra_value);
  } else {
    printf(
        "RESULT %s %s dev=%" PRIu64 " ino=%" PRIu64 " nlink=%" PRIu64 " size=%" PRIu64 "\n",
        op,
        name,
        stat_device(status),
        stat_inode(status),
        (uint64_t)status->st_nlink,
        (uint64_t)status->st_size);
  }
  fflush(stdout);
}

static int command_export(int argc, char **argv) {
  int root_fd = -1;
  int pause_before_effect = 0;
  for (int index = 2; index < argc; index++) {
    if (strcmp(argv[index], "--root-fd") == 0 && index + 1 < argc) {
      root_fd = (int)parse_u64(argv[index + 1], "--root-fd");
      index++;
      continue;
    }
    if (strcmp(argv[index], "--pause") == 0) {
      /*
       * Deterministic interleaving hook for adversarial tests: after the
       * component chain is verified and before the effect, report readiness
       * and wait for one line. A caller can then swap host objects to prove
       * that the effect still follows the verified descriptors. No
       * confinement decision depends on this flag.
       */
      pause_before_effect = 1;
      continue;
    }
    refuse(3, "unsupported export argument");
  }
  if (root_fd < 3) refuse(3, "export requires --root-fd with a descriptor above stdio");

  char line[MAX_LINE_BYTES];
  read_line(line, sizeof(line));
  expect_keyword(line, "PROTOCOL");
  uint64_t protocol = parse_u64(line + strlen("PROTOCOL") + 1, "PROTOCOL");
  if (protocol != PROTOCOL_VERSION) refuse(3, "unsupported protocol version");

  read_line(line, sizeof(line));
  expect_keyword(line, "ROOT");
  char *cursor = line + strlen("ROOT") + 1;
  char *device_text = strsep(&cursor, " ");
  char *inode_text = cursor;
  if (device_text == NULL || inode_text == NULL || strchr(inode_text, ' ') != NULL) {
    refuse(3, "malformed ROOT line");
  }
  uint64_t root_device = parse_u64(device_text, "ROOT device");
  uint64_t root_inode = parse_u64(inode_text, "ROOT inode");

  struct component components[MAX_COMPONENTS];
  size_t component_count = 0;

  read_line(line, sizeof(line));
  while (strncmp(line, "COMP ", 5) == 0) {
    if (component_count >= MAX_COMPONENTS) refuse(3, "too many components");
    char *rest = line + 5;
    char *component_device = strsep(&rest, " ");
    char *component_inode = strsep(&rest, " ");
    char *component_name = rest;
    if (component_device == NULL || component_inode == NULL || component_name == NULL) {
      refuse(3, "malformed COMP line");
    }
    struct component *component = &components[component_count++];
    component->device = parse_u64(component_device, "COMP device");
    component->inode = parse_u64(component_inode, "COMP inode");
    validate_name(component_name);
    snprintf(component->name, sizeof(component->name), "%s", component_name);
    read_line(line, sizeof(line));
  }

  expect_keyword(line, "OP");
  /*
   * Protocol fields are copied out of the line buffer: the buffer is reused by
   * the next read_line, so any pointer into it would alias later fields.
   */
  static char operation[16];
  snprintf(operation, sizeof(operation), "%s", line + strlen("OP") + 1);
  if (strcmp(operation, "create") != 0 && strcmp(operation, "mkdir") != 0 && strcmp(operation, "replace") != 0) {
    refuse(3, "unsupported operation");
  }
  g_operation = operation;

  read_line(line, sizeof(line));
  expect_keyword(line, "LEAF");
  char *leaf_rest = line + strlen("LEAF") + 1;
  char *leaf_device = strsep(&leaf_rest, " ");
  char *leaf_inode = strsep(&leaf_rest, " ");
  char *leaf_mode = strsep(&leaf_rest, " ");
  char *leaf_name = leaf_rest;
  if (leaf_device == NULL || leaf_inode == NULL || leaf_mode == NULL || leaf_name == NULL) {
    refuse(3, "malformed LEAF line");
  }
  uint64_t expected_device = parse_u64(leaf_device, "LEAF device");
  uint64_t expected_inode = parse_u64(leaf_inode, "LEAF inode");
  uint64_t leaf_mode_value = parse_u64(leaf_mode, "LEAF mode");
  if (leaf_mode_value > 0777) refuse(3, "LEAF mode is out of range");
  validate_name(leaf_name);
  static char leaf_name_copy[MAX_NAME_BYTES + 1];
  snprintf(leaf_name_copy, sizeof(leaf_name_copy), "%s", leaf_name);

  read_line(line, sizeof(line));
  expect_keyword(line, "SIZE");
  uint64_t payload_size = parse_u64(line + strlen("SIZE") + 1, "SIZE");
  if (payload_size > MAX_PAYLOAD_BYTES) refuse(3, "payload exceeds the supported size");

  /* Verify the root descriptor by identity before any traversal. */
  struct stat status;
  if (fstat(root_fd, &status) != 0) fail_errno(2, "root descriptor fstat failed");
  if (!S_ISDIR(status.st_mode)) refuse(2, "root descriptor is not a directory");
  if (stat_device(&status) != root_device || stat_inode(&status) != root_inode) {
    refuse(2, "root identity mismatch");
  }

  /*
   * One component per openat, each identity-checked. Every verified
   * descriptor stays open (and therefore bound to its object) through the
   * effect; the process exit releases them. Nothing here resolves a
   * multi-component name.
   */
  int current = root_fd;
  for (size_t index = 0; index < component_count; index++) {
    if (components[index].name[0] == '\0') refuse(2, "empty component name");
    int next = openat(current, components[index].name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
    if (next < 0) fail_errno(2, "component open (missing or symlink) failed");
    struct stat component_status;
    if (fstat(next, &component_status) != 0) fail_errno(2, "component fstat failed");
    if (!S_ISDIR(component_status.st_mode)) refuse(2, "component is not a directory");
    if (stat_device(&component_status) != components[index].device ||
        stat_inode(&component_status) != components[index].inode) {
      refuse(2, "component identity mismatch");
    }
    current = next;
  }

  unsigned char *payload = receive_payload(payload_size);

  if (pause_before_effect) {
    /*
     * Deterministic interleaving hook for adversarial tests. The payload has
     * already been received, so this barrier sits between full verification
     * and the effect; the caller sends one release line to proceed.
     */
    printf("ARMED\n");
    fflush(stdout);
    char release[MAX_LINE_BYTES];
    read_line(release, sizeof(release));
  }

  if (strcmp(operation, "mkdir") == 0) {
    if (mkdirat(current, leaf_name_copy, (mode_t)((leaf_mode_value & 0777) | 0700)) != 0) {
      fail_errno(2, "mkdirat failed (entry may already exist)");
    }
    int created = openat(current, leaf_name_copy, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
    if (created < 0) fail_errno(2, "created directory open failed");
    struct stat created_status;
    if (fstat(created, &created_status) != 0) fail_errno(2, "created directory fstat failed");
    if (!S_ISDIR(created_status.st_mode)) refuse(2, "created entry is not a directory");
    report_result("mkdir", leaf_name_copy, &created_status, NULL, 0);
    close(created);
    free(payload);
    return 0;
  }

  if (strcmp(operation, "create") == 0) {
    int created = openat(current, leaf_name_copy, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW, 0600);
    if (created < 0) fail_errno(2, "create failed (entry may already exist or be a symlink)");
    struct stat created_status;
    if (fstat(created, &created_status) != 0) fail_errno(2, "created file fstat failed");
    if (!S_ISREG(created_status.st_mode)) refuse(2, "created entry is not a regular file");
    if (created_status.st_nlink != 1) refuse(2, "created entry has nlink != 1");
    write_all(created, payload, (size_t)payload_size);
    if (fchmod(created, (mode_t)(leaf_mode_value & 0777)) != 0) fail_errno(2, "fchmod failed");
    struct stat final_status;
    if (fstat(created, &final_status) != 0) fail_errno(2, "final fstat failed");
    if ((uint64_t)final_status.st_size != payload_size) refuse(2, "created file size does not match the payload");
    if (stat_device(&final_status) != stat_device(&created_status) ||
        stat_inode(&final_status) != stat_inode(&created_status)) {
      refuse(2, "created file identity changed during the effect");
    }
    report_result("create", leaf_name_copy, &final_status, NULL, 0);
    close(created);
    free(payload);
    return 0;
  }

  /* replace */
  int target = openat(current, leaf_name_copy, O_RDWR | O_NOFOLLOW);
  if (target < 0) fail_errno(2, "target open failed (missing or symlink)");
  struct stat target_status;
  if (fstat(target, &target_status) != 0) fail_errno(2, "target fstat failed");
  if (!S_ISREG(target_status.st_mode)) refuse(2, "target is not a regular file");
  if (target_status.st_nlink != 1) refuse(2, "target has nlink != 1");
  if (stat_device(&target_status) != expected_device || stat_inode(&target_status) != expected_inode) {
    refuse(2, "target identity mismatch");
  }
  if (ftruncate(target, 0) != 0) fail_errno(2, "target truncate failed");
  write_all(target, payload, (size_t)payload_size);
  struct stat replaced_status;
  if (fstat(target, &replaced_status) != 0) fail_errno(2, "final target fstat failed");
  if ((uint64_t)replaced_status.st_size != payload_size) refuse(2, "replaced file size does not match the payload");
  if (stat_device(&replaced_status) != stat_device(&target_status) ||
      stat_inode(&replaced_status) != stat_inode(&target_status)) {
    refuse(2, "target identity changed during the effect");
  }
  if (fchmod(target, (mode_t)(leaf_mode_value & 0777)) != 0) fail_errno(2, "fchmod failed");
  report_result("replace", leaf_name_copy, &replaced_status, NULL, 0);
  close(target);
  free(payload);
  return 0;
}

/* ---------------------------------------------------------------- freeze -- */

/*
 * Descriptor-bound projection capture.
 *
 * The trusted parent opens both root directories without following symlinks
 * and verifies their identities against the import record; the helper
 * re-verifies both descriptors before the walk. Every name lookup is a single
 * component relative to a held directory descriptor, so no swap of any path
 * component during the copy can redirect a lookup: the opened object is the
 * one the identity measurement named, or the copy refuses. The frozen tree is
 * built with mkdirat/openat relative to the held target descriptors.
 */

#define PATH_TRACK_BYTES ((MAX_FREEZE_DEPTH + 1) * (MAX_NAME_BYTES + 1))

static uint64_t g_freeze_entries = 0;
static uint64_t g_freeze_bytes = 0;
static uint64_t g_freeze_max_entries = MAX_FREEZE_ENTRIES;
static uint64_t g_freeze_max_file = MAX_FREEZE_FILE_BYTES;
static uint64_t g_freeze_max_total = MAX_FREEZE_TOTAL_BYTES;
static int g_freeze_max_depth = MAX_FREEZE_DEPTH;
static char g_pause_name[MAX_LINE_BYTES];
static int g_pause_armed = 0;
static char g_relative_path[PATH_TRACK_BYTES];
static size_t g_relative_length = 0;
static unsigned char g_copy_buffer[READ_BUFFER_BYTES];

/* Pause names are projection-relative paths, not single components. */
static void validate_relative_path(const char *path) {
  if (path == NULL || path[0] == '\0') refuse(3, "pause name must not be empty");
  if (path[0] == '/') refuse(3, "pause name must be projection-relative");
  size_t length = strlen(path);
  if (length > PATH_TRACK_BYTES - 2) refuse(3, "pause name exceeds the tracked path bound");
  if (strstr(path, "//") != NULL || path[length - 1] == '/') refuse(3, "pause name has an empty component");
  char stack[PATH_TRACK_BYTES];
  snprintf(stack, sizeof(stack), "%s", path);
  char *cursor = stack;
  size_t components = 0;
  for (;;) {
    char *token = strsep(&cursor, "/");
    if (cursor == NULL && token == NULL) break;
    if (token == NULL) break;
    if (token[0] == '\0') {
      if (cursor == NULL) break;
      continue;
    }
    if (strcmp(token, ".") == 0) continue;
    if (strcmp(token, "..") == 0) refuse(3, "pause name must not contain '..'");
    if (components >= 128) refuse(3, "pause name has too many components");
    components += 1;
  }
  for (const char *scan = path; *scan != '\0'; scan++) {
    unsigned char byte = (unsigned char)*scan;
    if (byte < 0x20 || byte == 0x7f) refuse(3, "pause name must not contain control characters");
  }
}

static int compare_names(const void *left, const void *right) {
  return strcmp(*(char *const *)left, *(char *const *)right);
}

/*
 * Reads one directory's entries through a duplicate of the held descriptor
 * and returns them sorted by byte order. The enumeration is refused (never
 * truncated) on an unexpected error.
 */
static void collect_sorted_names(int held_fd, char ***out_names, size_t *out_count) {
  int duplicate = dup(held_fd);
  if (duplicate < 0) fail_errno(2, "descriptor duplication failed while freezing");
  DIR *directory = fdopendir(duplicate);
  if (directory == NULL) {
    close(duplicate);
    fail_errno(2, "directory enumeration failed while freezing");
  }
  char **names = NULL;
  size_t count = 0;
  size_t capacity = 0;
  errno = 0;
  struct dirent *entry;
  while ((entry = readdir(directory)) != NULL) {
    const char *name = entry->d_name;
    if (strcmp(name, ".") == 0 || strcmp(name, "..") == 0) continue;
    if (strlen(name) > MAX_NAME_BYTES) refuse(2, "entry name exceeds NAME_MAX");
    if (count == capacity) {
      size_t next = capacity == 0 ? 16 : capacity * 2;
      char **grown = realloc(names, next * sizeof(char *));
      if (grown == NULL) refuse(2, "directory enumeration buffer could not be allocated");
      names = grown;
      capacity = next;
    }
    names[count] = strdup(name);
    if (names[count] == NULL) refuse(2, "entry name could not be recorded");
    count += 1;
  }
  int read_error = errno;
  closedir(directory);
  if (read_error != 0) refuse(2, "directory enumeration failed (errno=%d)", read_error);
  qsort(names, count, sizeof(char *), compare_names);
  *out_names = names;
  *out_count = count;
}

/*
 * Deterministic interleaving hook for adversarial tests: when the walker is
 * about to process the paused entry — after its directory-entry identity was
 * measured, before it is opened — report the measured fields and wait for one
 * release line. A caller can then swap projection objects to prove that the
 * copy follows the held descriptors. No confinement decision depends on
 * this hook.
 */
static void maybe_pause(const struct stat *status) {
  if (g_pause_name[0] == '\0' || g_pause_armed) return;
  if (strcmp(g_relative_path, g_pause_name) != 0) return;
  g_pause_armed = 1;
  printf(
      "ARMED rel=%s dev=%" PRIu64 " ino=%" PRIu64 " mode=%llo size=%" PRIu64
      " mtimesec=%lld mtimensec=%ld nlink=%" PRIu64 "\n",
      g_relative_path,
      stat_device(status),
      stat_inode(status),
      (unsigned long long)status->st_mode,
      (uint64_t)status->st_size,
      (long long)status->st_mtimespec.tv_sec,
      (long)status->st_mtimespec.tv_nsec,
      (uint64_t)status->st_nlink);
  fflush(stdout);
  char release[MAX_LINE_BYTES];
  read_line(release, sizeof(release));
}

static void freeze_directory(int source_dir, int target_dir, int depth) {
  if (depth > g_freeze_max_depth) refuse(2, "projection depth limit reached while freezing");

  char **names = NULL;
  size_t count = 0;
  collect_sorted_names(source_dir, &names, &count);

  for (size_t index = 0; index < count; index++) {
    const char *name = names[index];
    g_freeze_entries += 1;
    if (g_freeze_entries > g_freeze_max_entries) {
      refuse(2, "projection exceeds the freeze entry limit");
    }
    size_t saved_length = g_relative_length;
    if (saved_length + strlen(name) + 2 > sizeof(g_relative_path)) {
      refuse(2, "relative path exceeds the tracked bound while freezing");
    }
    if (saved_length > 0) g_relative_path[g_relative_length++] = '/';
    for (const char *scan = name; *scan != '\0'; scan++) g_relative_path[g_relative_length++] = *scan;
    g_relative_path[g_relative_length] = '\0';

    struct stat measured;
    if (fstatat(source_dir, name, &measured, AT_SYMLINK_NOFOLLOW) != 0) {
      fail_errno(2, "projection entry disappeared while being frozen");
    }
    maybe_pause(&measured);

    if (S_ISLNK(measured.st_mode)) {
      char link_text[MAX_LINK_BYTES + 1];
      ssize_t length = readlinkat(source_dir, name, link_text, sizeof(link_text) - 1);
      if (length < 0) fail_errno(2, "projection symlink could not be read");
      if ((size_t)length >= sizeof(link_text) - 1) refuse(2, "projection symlink %s is too long", g_relative_path);
      if (memchr(link_text, 0, (size_t)length) != NULL) {
        refuse(2, "projection symlink %s contains a NUL byte", g_relative_path);
      }
      link_text[length] = '\0';
      if (symlinkat(link_text, target_dir, name) != 0) {
        fail_errno(2, "projection symlink %s could not be frozen", g_relative_path);
      }
    } else if (S_ISDIR(measured.st_mode)) {
      int opened = openat(source_dir, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
      if (opened < 0) fail_errno(2, "projection directory could not be opened for freezing");
      struct stat opened_status;
      if (fstat(opened, &opened_status) != 0) fail_errno(2, "projection directory fstat failed");
      if (!S_ISDIR(opened_status.st_mode)) refuse(2, "projection entry %s is not a directory", g_relative_path);
      if (stat_device(&opened_status) != stat_device(&measured) ||
          stat_inode(&opened_status) != stat_inode(&measured)) {
        refuse(2, "projection directory %s was replaced while being frozen", g_relative_path);
      }
      if (mkdirat(target_dir, name, (mode_t)0700) != 0) {
        fail_errno(2, "frozen directory %s could not be created", g_relative_path);
      }
      int created = openat(target_dir, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
      if (created < 0) fail_errno(2, "frozen directory %s could not be opened", g_relative_path);
      if (fchmod(created, (mode_t)(measured.st_mode & 0777)) != 0) {
        fail_errno(2, "frozen directory %s mode could not be preserved", g_relative_path);
      }
      freeze_directory(opened, created, depth + 1);
      close(created);
      close(opened);
    } else if (S_ISREG(measured.st_mode)) {
      if (measured.st_nlink != 1) refuse(2, "projection file %s has nlink != 1", g_relative_path);
      if ((uint64_t)measured.st_size > g_freeze_max_file) {
        refuse(2, "projection file %s exceeds the freeze size limit", g_relative_path);
      }
      int source = openat(source_dir, name, O_RDONLY | O_NOFOLLOW);
      if (source < 0) fail_errno(2, "projection file %s could not be opened for freezing", g_relative_path);
      struct stat opened_status;
      if (fstat(source, &opened_status) != 0) fail_errno(2, "projection file fstat failed while freezing");
      if (!S_ISREG(opened_status.st_mode) || opened_status.st_nlink != 1) {
        refuse(2, "projection file %s is not a singly-linked regular file", g_relative_path);
      }
      if (stat_device(&opened_status) != stat_device(&measured) ||
          stat_inode(&opened_status) != stat_inode(&measured)) {
        refuse(2, "projection file %s was replaced while being frozen", g_relative_path);
      }
      int target = openat(target_dir, name, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW, 0600);
      if (target < 0) fail_errno(2, "frozen file %s could not be created", g_relative_path);
      uint64_t total = 0;
      for (;;) {
        ssize_t got = read(source, g_copy_buffer, sizeof(g_copy_buffer));
        if (got < 0) {
          if (errno == EINTR) continue;
          fail_errno(2, "projection file %s could not be read while freezing", g_relative_path);
        }
        if (got == 0) break;
        total += (uint64_t)got;
        g_freeze_bytes += (uint64_t)got;
        if (total > g_freeze_max_file || g_freeze_bytes > g_freeze_max_total) {
          refuse(2, "projection exceeds the freeze byte limit");
        }
        write_all(target, g_copy_buffer, (size_t)got);
      }
      if (fchmod(target, (mode_t)(measured.st_mode & 0777)) != 0) {
        fail_errno(2, "frozen file %s mode could not be preserved", g_relative_path);
      }
      struct stat written_status;
      if (fstat(target, &written_status) != 0) fail_errno(2, "frozen file fstat failed");
      if ((uint64_t)written_status.st_size != total) {
        refuse(2, "frozen file %s does not hold the read bytes", g_relative_path);
      }
      close(target);
      struct stat after;
      if (fstat(source, &after) != 0) fail_errno(2, "projection file final fstat failed while freezing");
      if (stat_device(&after) != stat_device(&opened_status) ||
          stat_inode(&after) != stat_inode(&opened_status) ||
          after.st_nlink != 1 ||
          (uint64_t)after.st_size != (uint64_t)opened_status.st_size ||
          after.st_mtimespec.tv_sec != opened_status.st_mtimespec.tv_sec ||
          after.st_mtimespec.tv_nsec != opened_status.st_mtimespec.tv_nsec) {
        refuse(2, "projection file %s changed while being frozen", g_relative_path);
      }
      close(source);
    } else {
      refuse(2, "projection entry %s is not a file, directory or symlink", g_relative_path);
    }

    g_relative_length = saved_length;
    g_relative_path[saved_length] = '\0';
    free(names[index]);
  }
  free(names);
}

/*
 * Raises the descriptor budget above the worst case of the walk depth (used
 * by both the freeze copy and the measurement walk).
 */
static void ensure_descriptor_budget(void) {
  struct rlimit limit;
  if (getrlimit(RLIMIT_NOFILE, &limit) != 0) fail_errno(2, "descriptor limit query failed");
  uint64_t needed = (uint64_t)g_freeze_max_depth * 4 + 32;
  if ((uint64_t)limit.rlim_cur < needed) {
    if (limit.rlim_max != RLIM_INFINITY && (uint64_t)limit.rlim_max < needed) {
      refuse(2, "descriptor budget (%" PRIu64 ") is below the depth limit", (uint64_t)limit.rlim_max);
    }
    rlim_t want = limit.rlim_max == RLIM_INFINITY ? (rlim_t)needed
                                                 : (needed < (uint64_t)limit.rlim_max ? (rlim_t)needed
                                                                                      : limit.rlim_max);
    limit.rlim_cur = want;
    if (setrlimit(RLIMIT_NOFILE, &limit) != 0) fail_errno(2, "descriptor limit raise failed");
    if (getrlimit(RLIMIT_NOFILE, &limit) != 0 || (uint64_t)limit.rlim_cur < needed) {
      refuse(2, "descriptor budget is still below the depth limit");
    }
  }
}

static int command_freeze(int argc, char **argv) {
  int source_fd = -1;
  int target_fd = -1;
  for (int index = 2; index < argc; index++) {
    if (strcmp(argv[index], "--source-fd") == 0 && index + 1 < argc) {
      source_fd = (int)parse_u64(argv[index + 1], "--source-fd");
      index++;
      continue;
    }
    if (strcmp(argv[index], "--target-fd") == 0 && index + 1 < argc) {
      target_fd = (int)parse_u64(argv[index + 1], "--target-fd");
      index++;
      continue;
    }
    if (strcmp(argv[index], "--pause-name") == 0 && index + 1 < argc) {
      validate_relative_path(argv[index + 1]);
      snprintf(g_pause_name, sizeof(g_pause_name), "%s", argv[index + 1]);
      index++;
      continue;
    }
    refuse(3, "unsupported freeze argument");
  }
  if (source_fd < 3 || target_fd < 3) refuse(3, "freeze requires --source-fd and --target-fd above stdio");
  g_operation = "freeze";

  char line[MAX_LINE_BYTES];
  read_line(line, sizeof(line));
  expect_keyword(line, "PROTOCOL");
  uint64_t protocol = parse_u64(line + strlen("PROTOCOL") + 1, "PROTOCOL");
  if (protocol != PROTOCOL_VERSION) refuse(3, "unsupported protocol version");

  read_line(line, sizeof(line));
  expect_keyword(line, "SOURCE");
  char *source_cursor = line + strlen("SOURCE") + 1;
  char *source_device = strsep(&source_cursor, " ");
  char *source_inode = source_cursor;
  if (source_device == NULL || source_inode == NULL || strchr(source_inode, ' ') != NULL) {
    refuse(3, "malformed SOURCE line");
  }
  uint64_t expected_device = parse_u64(source_device, "SOURCE device");
  uint64_t expected_inode = parse_u64(source_inode, "SOURCE inode");

  read_line(line, sizeof(line));
  expect_keyword(line, "TARGET");
  char *target_cursor = line + strlen("TARGET") + 1;
  char *target_device = strsep(&target_cursor, " ");
  char *target_inode = target_cursor;
  if (target_device == NULL || target_inode == NULL || strchr(target_inode, ' ') != NULL) {
    refuse(3, "malformed TARGET line");
  }
  uint64_t frozen_device = parse_u64(target_device, "TARGET device");
  uint64_t frozen_inode = parse_u64(target_inode, "TARGET inode");

  read_line(line, sizeof(line));
  expect_keyword(line, "LIMITS");
  char *limits_cursor = line + strlen("LIMITS") + 1;
  char *entries_text = strsep(&limits_cursor, " ");
  char *file_text = strsep(&limits_cursor, " ");
  char *total_text = strsep(&limits_cursor, " ");
  char *depth_text = limits_cursor;
  if (entries_text == NULL || file_text == NULL || total_text == NULL || depth_text == NULL ||
      strchr(depth_text, ' ') != NULL) {
    refuse(3, "malformed LIMITS line");
  }
  g_freeze_max_entries = parse_u64(entries_text, "LIMITS entries");
  g_freeze_max_file = parse_u64(file_text, "LIMITS file bytes");
  g_freeze_max_total = parse_u64(total_text, "LIMITS total bytes");
  uint64_t depth_limit = parse_u64(depth_text, "LIMITS depth");
  if (depth_limit > MAX_FREEZE_DEPTH) refuse(3, "LIMITS depth exceeds the supported bound");
  if (g_freeze_max_entries > MAX_FREEZE_ENTRIES) refuse(3, "LIMITS entries exceed the supported bound");
  if (g_freeze_max_file > MAX_FREEZE_FILE_BYTES) refuse(3, "LIMITS file bytes exceed the supported bound");
  if (g_freeze_max_total > MAX_FREEZE_TOTAL_BYTES) refuse(3, "LIMITS total bytes exceed the supported bound");
  g_freeze_max_depth = (int)depth_limit;

  read_line(line, sizeof(line));
  if (strcmp(line, "GO") != 0) refuse(3, "expected GO after the freeze limits");

  struct stat source_status;
  if (fstat(source_fd, &source_status) != 0) fail_errno(2, "source descriptor fstat failed");
  if (!S_ISDIR(source_status.st_mode)) refuse(2, "source descriptor is not a directory");
  if (stat_device(&source_status) != expected_device || stat_inode(&source_status) != expected_inode) {
    refuse(2, "source identity mismatch");
  }
  struct stat target_status;
  if (fstat(target_fd, &target_status) != 0) fail_errno(2, "target descriptor fstat failed");
  if (!S_ISDIR(target_status.st_mode)) refuse(2, "target descriptor is not a directory");
  if (stat_device(&target_status) != frozen_device || stat_inode(&target_status) != frozen_inode) {
    refuse(2, "target identity mismatch");
  }

  ensure_descriptor_budget();
  g_relative_path[0] = '\0';
  freeze_directory(source_fd, target_fd, 0);

  printf("RESULT entries=%" PRIu64 " bytes=%" PRIu64 "\n", g_freeze_entries, g_freeze_bytes);
  fflush(stdout);
  return 0;
}

/* --------------------------------------------------------------- measure -- */

/*
 * Descriptor-bound projection measurement.
 *
 * The trusted parent opens the projection root without following symlinks and
 * verifies its identity; the helper re-verifies the descriptor before the
 * walk. Enumeration and every lookup are single components against held
 * directory descriptors, so a component swapped between the identity
 * measurement and the access cannot redirect the walk: directory descent
 * refuses a swapped symlink instead of following it, and the only name that
 * is ever read is one the held enumeration produced. The walk emits one ENTRY
 * line per object (paths and link text hex-encoded, so no entry name can
 * break the line protocol) and never copies bytes.
 */

#define MEASURE_ENTRY_LINE_BYTES (PATH_TRACK_BYTES * 2 + 256)
#define MEASURE_ENTRY_LINK_HEX_BYTES (2 * MAX_LINK_BYTES + 1)

static uint64_t g_measure_entries = 0;
static uint64_t g_measure_max_entries = MAX_FREEZE_ENTRIES;
static int g_measure_max_depth = MAX_FREEZE_DEPTH;
static char g_entry_rel_hex[MEASURE_ENTRY_LINE_BYTES];
static char g_entry_link_hex[MEASURE_ENTRY_LINK_HEX_BYTES];

static void hex_encode(const char *bytes, size_t length, char *out) {
  static const char hex_digits[] = "0123456789abcdef";
  for (size_t index = 0; index < length; index++) {
    out[index * 2] = hex_digits[((unsigned char)bytes[index]) >> 4];
    out[index * 2 + 1] = hex_digits[((unsigned char)bytes[index]) & 0x0f];
  }
  out[length * 2] = '\0';
}

static void measure_report_entry(const struct stat *status, const char *link_text, size_t link_length) {
  hex_encode(g_relative_path, g_relative_length, g_entry_rel_hex);
  if (link_text == NULL) {
    printf(
        "ENTRY rel=%s dev=%" PRIu64 " ino=%" PRIu64 " mode=%llo nlink=%" PRIu64
        " size=%" PRIu64 " mtimesec=%lld mtimensec=%ld link=-\n",
        g_entry_rel_hex,
        stat_device(status),
        stat_inode(status),
        (unsigned long long)status->st_mode,
        (uint64_t)status->st_nlink,
        (uint64_t)status->st_size,
        (long long)status->st_mtimespec.tv_sec,
        (long)status->st_mtimespec.tv_nsec);
  } else {
    hex_encode(link_text, link_length, g_entry_link_hex);
    printf(
        "ENTRY rel=%s dev=%" PRIu64 " ino=%" PRIu64 " mode=%llo nlink=%" PRIu64
        " size=%" PRIu64 " mtimesec=%lld mtimensec=%ld link=%s\n",
        g_entry_rel_hex,
        stat_device(status),
        stat_inode(status),
        (unsigned long long)status->st_mode,
        (uint64_t)status->st_nlink,
        (uint64_t)status->st_size,
        (long long)status->st_mtimespec.tv_sec,
        (long)status->st_mtimespec.tv_nsec,
        g_entry_link_hex);
  }
}

static void measure_directory(int dir_fd, int depth) {
  if (depth > g_measure_max_depth) refuse(2, "projection depth limit reached while measuring");

  char **names = NULL;
  size_t count = 0;
  collect_sorted_names(dir_fd, &names, &count);

  for (size_t index = 0; index < count; index++) {
    const char *name = names[index];
    g_measure_entries += 1;
    if (g_measure_entries > g_measure_max_entries) {
      refuse(2, "projection exceeds the measurement entry limit");
    }
    size_t saved_length = g_relative_length;
    if (saved_length + strlen(name) + 2 > sizeof(g_relative_path)) {
      refuse(2, "relative path exceeds the tracked bound while measuring");
    }
    if (saved_length > 0) g_relative_path[g_relative_length++] = '/';
    for (const char *scan = name; *scan != '\0'; scan++) g_relative_path[g_relative_length++] = *scan;
    g_relative_path[g_relative_length] = '\0';

    struct stat measured;
    if (fstatat(dir_fd, name, &measured, AT_SYMLINK_NOFOLLOW) != 0) {
      fail_errno(2, "projection entry %s disappeared while being measured", g_relative_path);
    }
    maybe_pause(&measured);

    if (S_ISDIR(measured.st_mode)) {
      /*
       * The identity was measured for the entry above; the open re-binds to
       * the same object or refuses. O_NONBLOCK keeps a name swapped for a
       * FIFO from stalling the open; O_DIRECTORY then rejects it.
       */
      int opened = openat(dir_fd, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_NONBLOCK);
      if (opened < 0) {
        fail_errno(2, "projection directory %s could not be opened for measurement", g_relative_path);
      }
      struct stat opened_status;
      if (fstat(opened, &opened_status) != 0) {
        fail_errno(2, "projection directory fstat failed while measuring");
      }
      if (!S_ISDIR(opened_status.st_mode)) {
        refuse(2, "projection entry %s is not a directory", g_relative_path);
      }
      if (stat_device(&opened_status) != stat_device(&measured) ||
          stat_inode(&opened_status) != stat_inode(&measured)) {
        refuse(2, "projection directory %s was replaced while being measured", g_relative_path);
      }
      measure_report_entry(&measured, NULL, 0);
      measure_directory(opened, depth + 1);
      close(opened);
    } else if (S_ISLNK(measured.st_mode)) {
      char link_text[MAX_LINK_BYTES + 1];
      ssize_t length = readlinkat(dir_fd, name, link_text, sizeof(link_text) - 1);
      if (length < 0) {
        /*
         * The entry was measured as a symlink but its text cannot be read
         * right now (removed or replaced in the measure→read window). The
         * entry is still reported with no text: a window-to-window or
         * scan-time comparison then sees the change.
         */
        measure_report_entry(&measured, NULL, 0);
      } else if ((size_t)length >= sizeof(link_text) - 1) {
        refuse(2, "projection symlink %s is too long to measure", g_relative_path);
      } else {
        measure_report_entry(&measured, link_text, (size_t)length);
      }
    } else {
      measure_report_entry(&measured, NULL, 0);
    }

    g_relative_length = saved_length;
    g_relative_path[saved_length] = '\0';
    free(names[index]);
  }
  free(names);
}

static int command_measure(int argc, char **argv) {
  int root_fd = -1;
  for (int index = 2; index < argc; index++) {
    if (strcmp(argv[index], "--root-fd") == 0 && index + 1 < argc) {
      root_fd = (int)parse_u64(argv[index + 1], "--root-fd");
      index++;
      continue;
    }
    if (strcmp(argv[index], "--pause-name") == 0 && index + 1 < argc) {
      validate_relative_path(argv[index + 1]);
      snprintf(g_pause_name, sizeof(g_pause_name), "%s", argv[index + 1]);
      index++;
      continue;
    }
    refuse(3, "unsupported measure argument");
  }
  if (root_fd < 3) refuse(3, "measure requires --root-fd with a descriptor above stdio");
  g_operation = "measure";

  char line[MAX_LINE_BYTES];
  read_line(line, sizeof(line));
  expect_keyword(line, "PROTOCOL");
  uint64_t protocol = parse_u64(line + strlen("PROTOCOL") + 1, "PROTOCOL");
  if (protocol != PROTOCOL_VERSION) refuse(3, "unsupported protocol version");

  read_line(line, sizeof(line));
  expect_keyword(line, "ROOT");
  char *root_cursor = line + strlen("ROOT") + 1;
  char *root_device_text = strsep(&root_cursor, " ");
  char *root_inode_text = root_cursor;
  if (root_device_text == NULL || root_inode_text == NULL || strchr(root_inode_text, ' ') != NULL) {
    refuse(3, "malformed ROOT line");
  }
  uint64_t expected_device = parse_u64(root_device_text, "ROOT device");
  uint64_t expected_inode = parse_u64(root_inode_text, "ROOT inode");

  read_line(line, sizeof(line));
  expect_keyword(line, "LIMITS");
  char *limits_cursor = line + strlen("LIMITS") + 1;
  char *entries_text = strsep(&limits_cursor, " ");
  char *depth_text = limits_cursor;
  if (entries_text == NULL || depth_text == NULL || strchr(depth_text, ' ') != NULL) {
    refuse(3, "malformed LIMITS line");
  }
  g_measure_max_entries = parse_u64(entries_text, "LIMITS entries");
  uint64_t depth_limit = parse_u64(depth_text, "LIMITS depth");
  if (g_measure_max_entries > MAX_FREEZE_ENTRIES) refuse(3, "LIMITS entries exceed the supported bound");
  if (depth_limit > MAX_FREEZE_DEPTH) refuse(3, "LIMITS depth exceeds the supported bound");
  g_measure_max_depth = (int)depth_limit;

  read_line(line, sizeof(line));
  if (strcmp(line, "GO") != 0) refuse(3, "expected GO after the measure limits");

  struct stat status;
  if (fstat(root_fd, &status) != 0) fail_errno(2, "measured root descriptor fstat failed");
  if (!S_ISDIR(status.st_mode)) refuse(2, "measured root descriptor is not a directory");
  if (stat_device(&status) != expected_device || stat_inode(&status) != expected_inode) {
    refuse(2, "measured root identity mismatch");
  }

  ensure_descriptor_budget();
  g_relative_path[0] = '\0';
  measure_directory(root_fd, 0);

  printf("RESULT entries=%" PRIu64 "\n", g_measure_entries);
  fflush(stdout);
  return 0;
}

/* ---------------------------------------------------------------- census -- */

/*
 * Prints one line per process: "PROC <pid> <ppid> <pgid> <uid> <start_sec>
 * <start_usec>". The host classifies the invocation's processes from these
 * samples; the helper makes no kill or relocation decision itself.
 *
 * The sample is refused (never truncated) when the process table does not fit
 * the buffer: an approximate census must not be usable as a quiescence claim.
 */
static int command_census(void) {
  int mib[4] = {CTL_KERN, KERN_PROC, KERN_PROC_ALL, 0};
  size_t size = 0;
  if (sysctl(mib, 4, NULL, &size, NULL, 0) != 0) refuse(6, "process table size query failed");
  if (size == 0) refuse(6, "process table size is zero");
  struct kinfo_proc *procs = malloc(size);
  if (procs == NULL) refuse(6, "process table buffer could not be allocated");
  size_t requested = size;
  if (sysctl(mib, 4, procs, &size, NULL, 0) != 0) {
    free(procs);
    refuse(6, "process table read failed");
  }
  if (size >= requested) {
    /* The table grew between the two calls: a truncated sample is refused. */
    free(procs);
    refuse(6, "process table grew while sampling; the sample would be truncated");
  }
  size_t count = size / sizeof(struct kinfo_proc);
  for (size_t index = 0; index < count; index++) {
    const struct kinfo_proc *entry = &procs[index];
    printf(
        "PROC %d %d %d %u %lld %d\n",
        entry->kp_proc.p_pid,
        entry->kp_eproc.e_ppid,
        entry->kp_eproc.e_pgid,
        (unsigned)entry->kp_eproc.e_ucred.cr_uid,
        (long long)entry->kp_proc.p_starttime.tv_sec,
        (int)entry->kp_proc.p_starttime.tv_usec);
  }
  free(procs);
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: piwarden-helper <launch|export|freeze|measure|selftest|census> ...\n");
    return 64;
  }
  if (strcmp(argv[1], "launch") == 0) return command_launch(argc, argv);
  if (strcmp(argv[1], "export") == 0) return command_export(argc, argv);
  if (strcmp(argv[1], "freeze") == 0) return command_freeze(argc, argv);
  if (strcmp(argv[1], "selftest") == 0) return command_selftest();
  if (strcmp(argv[1], "measure") == 0) return command_measure(argc, argv);
  if (strcmp(argv[1], "census") == 0) return command_census();
  fprintf(stderr, "unknown command\n");
  return 64;
}

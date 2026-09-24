import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  classifyPathResource,
  ResourceClassificationError,
  type ResourceClassification,
  type ResourceMatch,
} from "../src/policy/resources.ts";
import {
  PathCanonicalizationError,
  resolveWorkspacePath,
  type CanonicalPathResult,
  type ResolvedPath,
} from "../src/policy/paths.ts";

interface ResourceFixture {
  readonly root: string;
  readonly workspace: string;
  readonly outside: string;
  classify(originalPath: string): Promise<ResourceClassification>;
}

interface Fixture {
  readonly root: string;
  readonly workspace: string;
  readonly outside: string;
}

const RESOURCE_FILES = [
  // Ordinary paths inside the workspace.
  "project/src/index.ts",
  "project/token.txt",
  "project/passwords.md",
  "project/credentials.json",
  "project/config.json",
  "project/auth.json",
  "project/.env.production",
  // Environment templates inside the workspace.
  "project/.env.example",
  "project/.env.sample",
  "project/.env.template",
  "project/.env.dist",
  "project/.ENV.EXAMPLE",
  // Compound environment templates with a complete marker token.
  "project/.env.example.production",
  "project/.env.production.example",
  "project/.env.production.example.local",
  "project/.env.sample.production",
  "project/.env.production.sample",
  "project/.env.production.sample.local",
  "project/.env.template.production",
  "project/.env.production.template",
  "project/.env.production.template.local",
  "project/.env.dist.production",
  "project/.env.production.dist",
  "project/.env.production.dist.local",
  // Environment template near misses that remain secret env-files.
  "project/.env.examples",
  "project/.env.production.sampled",
  "project/.env.example-backup",
  "project/.env.production-template",
  "project/.env.d\u0456st",
  // Built-in sensitive/secret rule paths at the fixture root.
  ".env",
  ".env.local",
  ".env.production",
  ".env.example",
  ".ssh/config",
  "keys/id_rsa",
  "certificate.pem",
  "private.key",
  "private.p12",
  "private.pfx",
  ".aws/credentials",
  ".aws/sso/cache/session.json",
  ".aws/sso/cache/.env.production.example",
  ".config/gcloud/credentials.db",
  ".config/gcloud/access_tokens.db",
  ".config/gcloud/application_default_credentials.json",
  ".config/gh/hosts.yml",
  ".kube/config",
  ".docker/config.json",
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".yarnrc.yml",
  ".git-credentials",
  // Anchored and component near misses.
  "notes.env.production.md",
  ".environment",
  ".ssh-backup/config",
  "id_ed25519.pub",
  "id_rsa.backup",
  "client.pem.txt",
  "private.key.pub",
  ".aws/credentials.json",
  ".aws-sso/cache/session.json",
  "application_default_credentials.json",
  "gcloud/application_default_credentials.json",
  "gh/hosts.yml",
  "team/gcloud/credentials.db",
  "gcloud/credentials.sqlite",
  ".config-backup/gh/hosts.yml",
  ".config/gh-backup/hosts.yml",
  ".config/team/gh/hosts.yml",
  ".config/gh/hosts.yaml",
  ".config/gh/hosts.yml.backup",
  ".config/gcloud-backup/credentials.db",
  ".config/team/gcloud/credentials.db",
  ".config/gcloud/credentials.sqlite",
  ".config/gcloud/access_tokens.db.backup",
  ".kube/config.yaml",
  ".docker/configuration.json",
  "netrc",
  "project.git-credentials",
  ".npmrc.example",
  // SSH context.
  ".ssh/known_hosts",
  ".ssh/id_ed25519.pub",
  ".ssh/.env.example.production",
  // Conventional SSH private-key basenames.
  "keys/id_dsa",
  "keys/id_ecdsa",
  "keys/id_ed25519",
  // Conventional SSH private-key backup basenames.
  "keys/id_rsa.bak",
  "keys/id_rsa.backup",
  "keys/id_rsa.old",
  "keys/id_rsa~",
  "keys/id_dsa.bak",
  "keys/id_dsa.backup",
  "keys/id_dsa.old",
  "keys/id_dsa~",
  "keys/id_ecdsa.bak",
  "keys/id_ecdsa.backup",
  "keys/id_ecdsa.old",
  "keys/id_ecdsa~",
  "keys/id_ed25519.bak",
  "keys/id_ed25519.backup",
  "keys/id_ed25519.old",
  "keys/id_ed25519~",
  // SSH private-key backup near misses.
  "project/id_rsa.bak.bak",
  "project/id_rsa.backup.old",
  "project/id_rsa~~",
  "project/id_rsa.backup.txt",
  "project/id_rsa.backup-2026",
  "project/id_rsa.save",
  "project/id_rsa.bakery",
  "project/my_id_rsa.bak",
  "project/id_rsa2.bak",
  "project/id_r\u0455a.bak",
  // Public SSH key variants that must not match the private-key rule.
  "project/id_rsa.pub",
  "project/id_rsa.pub.bak",
  "project/id_rsa.pub.backup",
  "project/id_rsa.pub.old",
  "project/id_rsa.pub~",
  "project/id_rsa.bak.pub",
  "project/id_rsa.backup.pub",
  "project/id_rsa.old.pub",
  "project/id_rsa~.pub",
  "project/id_dsa.pub",
  "project/id_dsa.pub.bak",
  "project/id_dsa.pub.backup",
  "project/id_dsa.pub.old",
  "project/id_dsa.pub~",
  "project/id_dsa.bak.pub",
  "project/id_dsa.backup.pub",
  "project/id_dsa.old.pub",
  "project/id_dsa~.pub",
  "project/id_ecdsa.pub",
  "project/id_ecdsa.pub.bak",
  "project/id_ecdsa.pub.backup",
  "project/id_ecdsa.pub.old",
  "project/id_ecdsa.pub~",
  "project/id_ecdsa.bak.pub",
  "project/id_ecdsa.backup.pub",
  "project/id_ecdsa.old.pub",
  "project/id_ecdsa~.pub",
  "project/id_ed25519.pub",
  "project/id_ed25519.pub.bak",
  "project/id_ed25519.pub.backup",
  "project/id_ed25519.pub.old",
  "project/id_ed25519.pub~",
  "project/id_ed25519.bak.pub",
  "project/id_ed25519.backup.pub",
  "project/id_ed25519.old.pub",
  "project/id_ed25519~.pub",
  // Public SSH key backup and private-key backup beneath .ssh.
  ".ssh/id_ed25519.pub.backup",
  ".ssh/id_rsa.backup",
  // PEM.
  "certs/server.pem",
  // Generic key extensions.
  "project/slides.key",
  "project/SLIDES.KEY",
  "project/Slides.Key",
  // Key-extension near misses.
  "project/slides.key.txt",
  "project/slides.key.pub",
  "project/slides.key.backup",
  "project/slides.keychain",
  "project/slides.p12.bak",
  "project/slides.pfx.txt",
  "project/slides.kez",
  "project/slides.k\u0435y",
  "project/.key",
  // Key-extension overlays.
  "project/.env.example.key",
  "project/.env.production.key",
  ".aws/sso/cache/session.key",
  // ASCII case-insensitive variants.
  ".ENV.PRODUCTION",
  ".SSH/ID_ED25519",
  ".AWS/CREDENTIALS",
  "PRIVATE.P12",
  "PRIVATE.KEY",
  "PRIVATE.PFX",
  // Multiple categories.
  ".ssh/client.key",
  // Unicode lookalikes.
  ".\u0435nv",
  ".\u0455\u0455h/config",
  "id_r\u0430sa",
];

function mapPath(root: string, originalPath: string): string {
  if (originalPath === "/fixture") return root;
  if (originalPath.startsWith("/fixture/")) {
    return path.join(root, originalPath.slice("/fixture/".length));
  }
  return originalPath;
}

async function withResourceFixture(
  run: (fixture: ResourceFixture) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-warden-resources-"));
  const workspace = path.join(root, "project");
  const outside = path.join(root, "outside");

  try {
    await mkdir(workspace, { recursive: true });
    await mkdir(outside, { recursive: true });

    for (const relativePath of RESOURCE_FILES) {
      const filePath = path.join(root, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "fake fixture");
    }

    const classify = async (originalPath: string) => {
      const targetPath = mapPath(root, originalPath);
      const resolved = await resolveWorkspacePath(workspace, targetPath);
      return classifyPathResource(resolved);
    };

    await run({ root, workspace, outside, classify });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function withFixture(run: (fixture: Fixture) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-warden-resources-"));
  const fixture = {
    root,
    workspace: path.join(root, "project"),
    outside: path.join(root, "outside"),
  };

  try {
    await Promise.all([mkdir(fixture.workspace), mkdir(fixture.outside)]);
    await run(fixture);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("classifies ordinary and generic credential-looking filenames as ordinary", async () => {
  await withResourceFixture(async ({ classify }) => {
    const ordinaryPaths = [
      "/fixture/project/src/index.ts",
      "/fixture/project/token.txt",
      "/fixture/project/passwords.md",
      "/fixture/project/credentials.json",
      "/fixture/project/config.json",
      "/fixture/project/auth.json",
    ];

    for (const resourcePath of ordinaryPaths) {
      assert.deepEqual(await classify(resourcePath), {
        sensitivity: "ordinary",
        matches: [],
      });
    }
  });
});

test("classifies every initial built-in rule", async () => {
  await withResourceFixture(async ({ classify }) => {
    const cases: readonly {
      readonly path: string;
      readonly expected: ResourceClassification;
    }[] = [
      {
        path: "/fixture/.env",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "environment",
              sensitivity: "secret",
              reason: "env-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.env.local",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "environment",
              sensitivity: "secret",
              reason: "env-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.env.production",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "environment",
              sensitivity: "secret",
              reason: "env-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.env.example",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "environment",
              sensitivity: "sensitive",
              reason: "env-template",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.ssh/config",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "ssh-credentials",
              sensitivity: "sensitive",
              reason: "ssh-directory",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/keys/id_rsa",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "ssh-credentials",
              sensitivity: "secret",
              reason: "ssh-private-key-name",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/certificate.pem",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "private-key",
              sensitivity: "sensitive",
              reason: "pem-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/private.p12",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "private-key",
              sensitivity: "secret",
              reason: "private-key-extension",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/private.pfx",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "private-key",
              sensitivity: "secret",
              reason: "private-key-extension",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.aws/credentials",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "aws-credentials",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.aws/sso/cache/session.json",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "aws-sso-cache",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.config/gcloud/credentials.db",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "gcloud-credentials",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.config/gcloud/access_tokens.db",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "gcloud-credentials",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.config/gcloud/application_default_credentials.json",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "gcloud-credentials",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.config/gh/hosts.yml",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "service-credentials",
              sensitivity: "secret",
              reason: "github-cli-credentials",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.kube/config",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "kubeconfig",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.docker/config.json",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "service-credentials",
              sensitivity: "secret",
              reason: "docker-auth",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.netrc",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "service-credentials",
              sensitivity: "secret",
              reason: "netrc",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.npmrc",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "package-auth",
              sensitivity: "sensitive",
              reason: "package-auth-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.pypirc",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "package-auth",
              sensitivity: "sensitive",
              reason: "package-auth-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.yarnrc.yml",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "package-auth",
              sensitivity: "sensitive",
              reason: "package-auth-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.git-credentials",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "git-credentials",
              sensitivity: "secret",
              reason: "git-credential-store",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
    ];

    assert.deepEqual(await classify("/fixture/private.key"), {
      sensitivity: "sensitive",
      matches: [
        {
          category: "private-key",
          sensitivity: "sensitive",
          reason: "private-key-extension",
          evidence: ["canonical-path", "lexical-path"],
        },
      ],
    });

    for (const { path: resourcePath, expected } of cases) {
      assert.deepEqual(await classify(resourcePath), expected, resourcePath);
    }
  });
});

test("classifies direct and compound environment templates with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    const basenames = [
      ".env.example",
      ".env.sample",
      ".env.template",
      ".env.dist",
      ".ENV.EXAMPLE",
    ];

    for (const marker of ["example", "sample", "template", "dist"] as const) {
      const upperMarker = marker.toUpperCase();
      const titledMarker = `${upperMarker[0]}${marker.slice(1)}`;
      basenames.push(
        `.env.${marker}.production`,
        `.env.production.${marker}`,
        `.env.production.${marker}.local`,
        `.ENV.${upperMarker}.PRODUCTION`,
        `.env.PRODUCTION.${upperMarker}`,
        `.ENV.Production.${titledMarker}.Local`,
      );
    }

    for (const basename of basenames) {
      const result = await classify(path.join("/fixture/project", basename));
      assert.equal(result.sensitivity, "sensitive", basename);
      assert.deepEqual(
        result.matches,
        [
          {
            category: "environment",
            sensitivity: "sensitive",
            reason: "env-template",
            evidence: ["canonical-path", "lexical-path"],
          },
        ],
        basename,
      );
    }
  });
});

test("keeps non-marker .env basenames as secret env-files with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const basename of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.examples",
      ".env.production.sampled",
      ".env.example-backup",
      ".env.production-template",
      ".env.d\u0456st",
    ]) {
      const resourcePath = path.join("/fixture/project", basename);
      const result = await classify(resourcePath);
      assert.equal(result.sensitivity, "secret", resourcePath);
      assert.deepEqual(
        result.matches,
        [
          {
            category: "environment",
            sensitivity: "secret",
            reason: "env-file",
            evidence: ["canonical-path", "lexical-path"],
          },
        ],
        resourcePath,
      );
    }
  });
});

test("does not treat marker-like text outside an exact .env. basename as a template", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const resourcePath of [
      "/fixture/project/notes.env.example",
      "/fixture/project/.environment.example",
      "/fixture/project/env.example",
    ]) {
      assert.deepEqual(
        await classify(resourcePath),
        { sensitivity: "ordinary", matches: [] },
        resourcePath,
      );
    }
  });
});

test("does not inherit template recognition from a parent directory name", async () => {
  await withFixture(async ({ workspace }) => {
    const templateDirectory = path.join(workspace, ".env.example");
    await mkdir(templateDirectory);
    await writeFile(path.join(templateDirectory, ".env.production"), "fake fixture");

    const resolved = await resolveWorkspacePath(
      workspace,
      ".env.example/.env.production",
    );
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("classifies a nonexistent compound environment template target resolved by Phase 1A", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(
      workspace,
      ".env.production.example",
    );

    assert.equal(resolved.targetExists, false);
    const result = classifyPathResource(resolved);
    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("uses canonical-only environment template evidence for a benign symlink alias", async () => {
  await withFixture(async ({ workspace }) => {
    const templatePath = path.join(workspace, ".env.example.production");
    await writeFile(templatePath, "fake fixture");
    await symlink(templatePath, path.join(workspace, "innocent-link"));

    const resolved = await resolveWorkspacePath(workspace, "innocent-link");
    const result = classifyPathResource(resolved);

    assert.equal(resolved.targetExists, true);
    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("uses lexical-only environment template evidence for a compound-template-looking symlink to an ordinary target", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");
    await symlink(ordinaryTarget, path.join(workspace, ".env.example.production"));

    const resolved = await resolveWorkspacePath(
      workspace,
      ".env.example.production",
    );
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("preserves distinct environment evidence across both alias directions", async () => {
  await withFixture(async ({ workspace }) => {
    const templateAliasDirectory = path.join(workspace, "template-alias");
    await mkdir(templateAliasDirectory);
    const secretTarget = path.join(templateAliasDirectory, ".env.production");
    await writeFile(secretTarget, "fake fixture");
    await symlink(
      secretTarget,
      path.join(templateAliasDirectory, ".env.example.production"),
    );

    const templateAlias = await resolveWorkspacePath(
      workspace,
      "template-alias/.env.example.production",
    );
    const templateAliasResult = classifyPathResource(templateAlias);

    assert.equal(templateAliasResult.sensitivity, "secret");
    assert.deepEqual(templateAliasResult.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["lexical-path"],
      },
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["canonical-path"],
      },
    ]);

    const secretAliasDirectory = path.join(workspace, "secret-alias");
    await mkdir(secretAliasDirectory);
    const templateTarget = path.join(
      secretAliasDirectory,
      ".env.example.production",
    );
    await writeFile(templateTarget, "fake fixture");
    await symlink(
      templateTarget,
      path.join(secretAliasDirectory, ".env.production"),
    );

    const secretAlias = await resolveWorkspacePath(
      workspace,
      "secret-alias/.env.production",
    );
    const secretAliasResult = classifyPathResource(secretAlias);

    assert.equal(secretAliasResult.sensitivity, "secret");
    assert.deepEqual(secretAliasResult.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["canonical-path"],
      },
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("orders environment template evidence before SSH context with maximum sensitivity preserved", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify("/fixture/.ssh/.env.example.production");

    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["canonical-path", "lexical-path"],
      },
      {
        category: "ssh-credentials",
        sensitivity: "sensitive",
        reason: "ssh-directory",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("keeps an unrelated secret rule dominant over a compound environment template", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify(
      "/fixture/.aws/sso/cache/.env.production.example",
    );

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "sensitive",
        reason: "env-template",
        evidence: ["canonical-path", "lexical-path"],
      },
      {
        category: "cloud-credentials",
        sensitivity: "secret",
        reason: "aws-sso-cache",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("does not classify anchored and component near misses", async () => {
  await withResourceFixture(async ({ classify }) => {
    const nearMisses = [
      "/fixture/notes.env.production.md",
      "/fixture/.environment",
      "/fixture/.ssh-backup/config",
      "/fixture/id_ed25519.pub",
      "/fixture/client.pem.txt",
      "/fixture/private.key.pub",
      "/fixture/.aws/credentials.json",
      "/fixture/.aws-sso/cache/session.json",
      "/fixture/application_default_credentials.json",
      "/fixture/gcloud/application_default_credentials.json",
      "/fixture/gh/hosts.yml",
      "/fixture/team/gcloud/credentials.db",
      "/fixture/gcloud/credentials.sqlite",
      "/fixture/.config-backup/gh/hosts.yml",
      "/fixture/.config/gh-backup/hosts.yml",
      "/fixture/.config/team/gh/hosts.yml",
      "/fixture/.config/gh/hosts.yaml",
      "/fixture/.config/gh/hosts.yml.backup",
      "/fixture/.config/gcloud-backup/credentials.db",
      "/fixture/.config/team/gcloud/credentials.db",
      "/fixture/.config/gcloud/credentials.sqlite",
      "/fixture/.config/gcloud/access_tokens.db.backup",
      "/fixture/.kube/config.yaml",
      "/fixture/.docker/configuration.json",
      "/fixture/netrc",
      "/fixture/project.git-credentials",
      "/fixture/.npmrc.example",
    ];

    for (const resourcePath of nearMisses) {
      assert.deepEqual(await classify(resourcePath), {
        sensitivity: "ordinary",
        matches: [],
      });
    }
  });
});

test("treats SSH context as sensitive without upgrading public resources", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const resourcePath of [
      "/fixture/.ssh",
      "/fixture/.ssh/config",
      "/fixture/.ssh/known_hosts",
      "/fixture/.ssh/id_ed25519.pub",
    ]) {
      const result = await classify(resourcePath);
      assert.deepEqual(
        result,
        {
          sensitivity: "sensitive",
          matches: [
            {
              category: "ssh-credentials",
              sensitivity: "sensitive",
              reason: "ssh-directory",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
        resourcePath,
      );
    }
  });
});

test("recognizes each conventional SSH private-key basename with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const basename of ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"]) {
      const result = await classify(path.join("/fixture/keys", basename));
      assert.deepEqual(
        result,
        {
          sensitivity: "secret",
          matches: [
            {
              category: "ssh-credentials",
              sensitivity: "secret",
              reason: "ssh-private-key-name",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
        basename,
      );
    }
  });
});

test("classifies a direct SSH private-key backup as secret with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify("/fixture/id_rsa.backup");
    assert.deepEqual(result, {
      sensitivity: "secret",
      matches: [
        {
          category: "ssh-credentials",
          sensitivity: "secret",
          reason: "ssh-private-key-name",
          evidence: ["canonical-path", "lexical-path"],
        },
      ],
    });
  });
});

test("recognizes each conventional SSH private-key backup filename with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    const bases = ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"] as const;
    const suffixes = [".bak", ".backup", ".old", "~"] as const;

    for (const base of bases) {
      for (const suffix of suffixes) {
        const basename = `${base}${suffix}`;
        const result = await classify(path.join("/fixture/keys", basename));
        assert.deepEqual(
          result,
          {
            sensitivity: "secret",
            matches: [
              {
                category: "ssh-credentials",
                sensitivity: "secret",
                reason: "ssh-private-key-name",
                evidence: ["canonical-path", "lexical-path"],
              },
            ],
          },
          basename,
        );
      }
    }
  });
});

test("matches ASCII mixed-case variants of SSH private-key names and backups", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const basename of [
      "ID_RSA",
      "Id_Dsa",
      "ID_ECDSA",
      "ID_ED25519",
      "ID_RSA.BAK",
      "Id_Rsa.Backup",
      "ID_DSA.OLD",
      "id_ECDSA.Bak",
      "ID_ED25519~",
    ]) {
      const result = await classify(path.join("/fixture/keys", basename));
      assert.deepEqual(
        result,
        {
          sensitivity: "secret",
          matches: [
            {
              category: "ssh-credentials",
              sensitivity: "secret",
              reason: "ssh-private-key-name",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
        basename,
      );
    }
  });
});

test("does not classify SSH private-key backup near misses", async () => {
  await withResourceFixture(async ({ classify }) => {
    const nearMisses = [
      "/fixture/project/id_rsa.bak.bak",
      "/fixture/project/id_rsa.backup.old",
      "/fixture/project/id_rsa~~",
      "/fixture/project/id_rsa.backup.txt",
      "/fixture/project/id_rsa.backup-2026",
      "/fixture/project/id_rsa.save",
      "/fixture/project/id_rsa.bakery",
      "/fixture/project/my_id_rsa.bak",
      "/fixture/project/id_rsa2.bak",
      "/fixture/project/id_r\u0455a.bak",
    ];

    for (const resourcePath of nearMisses) {
      assert.deepEqual(
        await classify(resourcePath),
        { sensitivity: "ordinary", matches: [] },
        resourcePath,
      );
    }
  });
});

test("does not classify public SSH key variants as private-key backups", async () => {
  await withResourceFixture(async ({ classify }) => {
    const bases = ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"] as const;
    const publicVariants = [
      ".pub",
      ".pub.bak",
      ".pub.backup",
      ".pub.old",
      ".pub~",
      ".bak.pub",
      ".backup.pub",
      ".old.pub",
      "~.pub",
    ] as const;

    for (const base of bases) {
      for (const variant of publicVariants) {
        const resourcePath = path.join("/fixture/project", `${base}${variant}`);
        assert.deepEqual(
          await classify(resourcePath),
          { sensitivity: "ordinary", matches: [] },
          resourcePath,
        );
      }
    }
  });
});

test("keeps a public SSH backup under .ssh sensitive through ssh-directory only", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify("/fixture/.ssh/id_ed25519.pub.backup");

    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "sensitive",
        reason: "ssh-directory",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("does not classify an ordinary child of a directory named id_rsa.backup", async () => {
  await withFixture(async ({ workspace }) => {
    const backupDirectory = path.join(workspace, "id_rsa.backup");
    await mkdir(backupDirectory);
    await writeFile(path.join(backupDirectory, "notes.txt"), "fake fixture");

    const resolved = await resolveWorkspacePath(
      workspace,
      "id_rsa.backup/notes.txt",
    );
    const result = classifyPathResource(resolved);

    assert.deepEqual(result, { sensitivity: "ordinary", matches: [] });
  });
});

test("classifies an SSH private-key backup beneath .ssh with ordered matches", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify("/fixture/.ssh/id_rsa.backup");

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "sensitive",
        reason: "ssh-directory",
        evidence: ["canonical-path", "lexical-path"],
      },
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("classifies a nonexistent SSH private-key backup target resolved by Phase 1A", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "id_ed25519.backup");

    assert.equal(resolved.targetExists, false);
    const result = classifyPathResource(resolved);
    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("uses canonical-only secret evidence for a benign alias to an SSH private-key backup", async () => {
  await withFixture(async ({ workspace }) => {
    const backupPath = path.join(workspace, "id_ed25519.bak");
    await writeFile(backupPath, "fake fixture");
    await symlink(backupPath, path.join(workspace, "innocent-link"));

    const resolved = await resolveWorkspacePath(workspace, "innocent-link");
    const result = classifyPathResource(resolved);

    assert.equal(resolved.targetExists, true);
    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("uses lexical-only secret evidence for a backup-looking alias to an ordinary target", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");
    await symlink(ordinaryTarget, path.join(workspace, "id_ed25519.bak"));

    const resolved = await resolveWorkspacePath(workspace, "id_ed25519.bak");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("merges both evidence sources for a backup-to-backup alias", async () => {
  await withFixture(async ({ workspace }) => {
    const backupTarget = path.join(workspace, "id_ed25519.bak");
    await writeFile(backupTarget, "fake fixture");
    await symlink(backupTarget, path.join(workspace, "id_rsa.bak"));

    const resolved = await resolveWorkspacePath(workspace, "id_rsa.bak");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("keeps the private identity dominant across public-looking backup alias directions", async () => {
  await withFixture(async ({ workspace }) => {
    const privateBackup = path.join(workspace, "id_ed25519.bak");
    await writeFile(privateBackup, "fake fixture");
    await symlink(privateBackup, path.join(workspace, "id_rsa.pub"));

    const publicAlias = await resolveWorkspacePath(workspace, "id_rsa.pub");
    const publicAliasResult = classifyPathResource(publicAlias);

    assert.equal(publicAliasResult.sensitivity, "secret");
    assert.deepEqual(publicAliasResult.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path"],
      },
    ]);

    const publicKey = path.join(workspace, "id_dsa.pub");
    await writeFile(publicKey, "fake fixture");
    await symlink(publicKey, path.join(workspace, "id_ecdsa.bak"));

    const backupAlias = await resolveWorkspacePath(workspace, "id_ecdsa.bak");
    const backupAliasResult = classifyPathResource(backupAlias);

    assert.equal(backupAliasResult.sensitivity, "secret");
    assert.deepEqual(backupAliasResult.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("preserves ordered ssh-private-key-name and private-key-extension across backup aliases", async () => {
  await withFixture(async ({ workspace }) => {
    const backupPath = path.join(workspace, "id_ed25519.bak");
    await writeFile(backupPath, "fake fixture");
    await symlink(backupPath, path.join(workspace, "innocent-link.key"));

    const keyAlias = await resolveWorkspacePath(workspace, "innocent-link.key");
    const keyAliasResult = classifyPathResource(keyAlias);

    assert.equal(keyAliasResult.sensitivity, "secret");
    assert.deepEqual(keyAliasResult.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path"],
      },
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["lexical-path"],
      },
    ]);

    const signingKeyPath = path.join(workspace, "signing.key");
    await writeFile(signingKeyPath, "fake fixture");
    await symlink(signingKeyPath, path.join(workspace, "id_dsa.bak"));

    const backupAlias = await resolveWorkspacePath(workspace, "id_dsa.bak");
    const backupAliasResult = classifyPathResource(backupAlias);

    assert.equal(backupAliasResult.sensitivity, "secret");
    assert.deepEqual(backupAliasResult.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["lexical-path"],
      },
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("classifies PEM as sensitive rather than secret", async () => {
  await withResourceFixture(async ({ classify }) => {
    assert.deepEqual(await classify("/fixture/certs/server.pem"), {
      sensitivity: "sensitive",
      matches: [
        {
          category: "private-key",
          sensitivity: "sensitive",
          reason: "pem-file",
          evidence: ["canonical-path", "lexical-path"],
        },
      ],
    });
  });
});

test("classifies generic key extensions as sensitive with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const resourcePath of [
      "/fixture/private.key",
      "/fixture/PRIVATE.KEY",
      "/fixture/project/slides.key",
      "/fixture/project/SLIDES.KEY",
      "/fixture/project/Slides.Key",
    ]) {
      const result = await classify(resourcePath);
      assert.equal(result.sensitivity, "sensitive", resourcePath);
      assert.deepEqual(
        result.matches,
        [
          {
            category: "private-key",
            sensitivity: "sensitive",
            reason: "private-key-extension",
            evidence: ["canonical-path", "lexical-path"],
          },
        ],
        resourcePath,
      );
    }
  });
});

test("keeps p12 and pfx extensions secret with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const resourcePath of [
      "/fixture/private.p12",
      "/fixture/private.pfx",
      "/fixture/PRIVATE.P12",
      "/fixture/PRIVATE.PFX",
    ]) {
      const result = await classify(resourcePath);
      assert.equal(result.sensitivity, "secret", resourcePath);
      assert.deepEqual(
        result.matches,
        [
          {
            category: "private-key",
            sensitivity: "secret",
            reason: "private-key-extension",
            evidence: ["canonical-path", "lexical-path"],
          },
        ],
        resourcePath,
      );
    }
  });
});

test("returns ordinary for key-extension near misses", async () => {
  await withResourceFixture(async ({ classify }) => {
    for (const resourcePath of [
      "/fixture/project/slides.key.txt",
      "/fixture/project/slides.key.pub",
      "/fixture/project/slides.key.backup",
      "/fixture/project/slides.keychain",
      "/fixture/project/slides.p12.bak",
      "/fixture/project/slides.pfx.txt",
      "/fixture/project/slides.kez",
      "/fixture/project/slides.k\u0435y",
      "/fixture/project/.key",
    ]) {
      assert.deepEqual(
        await classify(resourcePath),
        { sensitivity: "ordinary", matches: [] },
        resourcePath,
      );
    }
  });
});

test("classifies a nonexistent key-extension target resolved by Phase 1A", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, "missing.key");

    assert.equal(resolved.targetExists, false);
    const result = classifyPathResource(resolved);
    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("uses canonical-only sensitive evidence for a benign alias to a key-extension target", async () => {
  await withFixture(async ({ workspace }) => {
    const keyTarget = path.join(workspace, "actual.key");
    await writeFile(keyTarget, "fake fixture");
    await symlink(keyTarget, path.join(workspace, "innocent-link"));

    const resolved = await resolveWorkspacePath(workspace, "innocent-link");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("uses lexical-only sensitive evidence for a key-extension alias to an ordinary target", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");
    await symlink(ordinaryTarget, path.join(workspace, "looks-like.key"));

    const resolved = await resolveWorkspacePath(workspace, "looks-like.key");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("merges both evidence sources for a key-extension alias to a key-extension target", async () => {
  await withFixture(async ({ workspace }) => {
    const keyTarget = path.join(workspace, "target.key");
    await writeFile(keyTarget, "fake fixture");
    await symlink(keyTarget, path.join(workspace, "alias.key"));

    const resolved = await resolveWorkspacePath(workspace, "alias.key");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "sensitive");
    assert.deepEqual(result.matches, [
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("merges key and p12/pfx identities into one secret extension match in both alias directions", async () => {
  await withFixture(async ({ workspace }) => {
    for (const secretExtension of [".p12", ".pfx"] as const) {
      const label = secretExtension.slice(1);
      const secretTargetDirectory = path.join(workspace, `secret-target-${label}`);
      await mkdir(secretTargetDirectory);
      const secretTarget = path.join(secretTargetDirectory, `vault${secretExtension}`);
      await writeFile(secretTarget, "fake fixture");
      await symlink(secretTarget, path.join(secretTargetDirectory, "vault.key"));

      const keyAlias = await resolveWorkspacePath(
        workspace,
        `secret-target-${label}/vault.key`,
      );
      const keyAliasResult = classifyPathResource(keyAlias);

      assert.equal(keyAlias.targetExists, true);
      assert.equal(keyAliasResult.sensitivity, "secret");
      assert.deepEqual(keyAliasResult.matches, [
        {
          category: "private-key",
          sensitivity: "secret",
          reason: "private-key-extension",
          evidence: ["canonical-path", "lexical-path"],
        },
      ]);

      const keyTargetDirectory = path.join(workspace, `key-target-${label}`);
      await mkdir(keyTargetDirectory);
      const keyTarget = path.join(keyTargetDirectory, "vault.key");
      await writeFile(keyTarget, "fake fixture");
      await symlink(keyTarget, path.join(keyTargetDirectory, `vault${secretExtension}`));

      const secretAlias = await resolveWorkspacePath(
        workspace,
        `key-target-${label}/vault${secretExtension}`,
      );
      const secretAliasResult = classifyPathResource(secretAlias);

      assert.equal(secretAlias.targetExists, true);
      assert.equal(secretAliasResult.sensitivity, "secret");
      assert.deepEqual(secretAliasResult.matches, [
        {
          category: "private-key",
          sensitivity: "secret",
          reason: "private-key-extension",
          evidence: ["canonical-path", "lexical-path"],
        },
      ]);
    }
  });
});

test("keeps pem-file and key-extension matches distinct across an alias pair", async () => {
  await withFixture(async ({ workspace }) => {
    const pemTarget = path.join(workspace, "certificate.pem");
    await writeFile(pemTarget, "fake fixture");
    await symlink(pemTarget, path.join(workspace, "certificate.key"));

    const keyAlias = await resolveWorkspacePath(workspace, "certificate.key");
    const keyAliasResult = classifyPathResource(keyAlias);

    assert.equal(keyAliasResult.sensitivity, "sensitive");
    assert.deepEqual(keyAliasResult.matches, [
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "pem-file",
        evidence: ["canonical-path"],
      },
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["lexical-path"],
      },
    ]);

    const keyTarget = path.join(workspace, "signing.key");
    await writeFile(keyTarget, "fake fixture");
    await symlink(keyTarget, path.join(workspace, "signing.pem"));

    const pemAlias = await resolveWorkspacePath(workspace, "signing.pem");
    const pemAliasResult = classifyPathResource(pemAlias);

    assert.equal(pemAliasResult.sensitivity, "sensitive");
    assert.deepEqual(pemAliasResult.matches, [
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "pem-file",
        evidence: ["lexical-path"],
      },
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("preserves unrelated evidence alongside sensitive key extensions", async () => {
  await withResourceFixture(async ({ classify }) => {
    const cases: readonly {
      readonly path: string;
      readonly expected: ResourceClassification;
    }[] = [
      {
        path: "/fixture/project/.env.example.key",
        expected: {
          sensitivity: "sensitive",
          matches: [
            {
              category: "environment",
              sensitivity: "sensitive",
              reason: "env-template",
              evidence: ["canonical-path", "lexical-path"],
            },
            {
              category: "private-key",
              sensitivity: "sensitive",
              reason: "private-key-extension",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/project/.env.production.key",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "environment",
              sensitivity: "secret",
              reason: "env-file",
              evidence: ["canonical-path", "lexical-path"],
            },
            {
              category: "private-key",
              sensitivity: "sensitive",
              reason: "private-key-extension",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.aws/sso/cache/session.key",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "private-key",
              sensitivity: "sensitive",
              reason: "private-key-extension",
              evidence: ["canonical-path", "lexical-path"],
            },
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "aws-sso-cache",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
    ];

    for (const { path: resourcePath, expected } of cases) {
      assert.deepEqual(await classify(resourcePath), expected, resourcePath);
    }
  });
});

test("keeps ssh-private-key-name evidence dominant across key-extension aliases", async () => {
  await withFixture(async ({ workspace }) => {
    const privateKeyPath = path.join(workspace, "id_ed25519");
    await writeFile(privateKeyPath, "fake fixture");
    await symlink(privateKeyPath, path.join(workspace, "innocent-link.key"));

    const keyAlias = await resolveWorkspacePath(workspace, "innocent-link.key");
    const keyAliasResult = classifyPathResource(keyAlias);

    assert.equal(keyAliasResult.sensitivity, "secret");
    assert.deepEqual(keyAliasResult.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["canonical-path"],
      },
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["lexical-path"],
      },
    ]);

    const signingKeyPath = path.join(workspace, "signing.key");
    await writeFile(signingKeyPath, "fake fixture");
    await symlink(signingKeyPath, path.join(workspace, "id_rsa"));

    const nameAlias = await resolveWorkspacePath(workspace, "id_rsa");
    const nameAliasResult = classifyPathResource(nameAlias);

    assert.equal(nameAliasResult.sensitivity, "secret");
    assert.deepEqual(nameAliasResult.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "secret",
        reason: "ssh-private-key-name",
        evidence: ["lexical-path"],
      },
      {
        category: "private-key",
        sensitivity: "sensitive",
        reason: "private-key-extension",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("supports conservative ASCII case-insensitive matching", async () => {
  await withResourceFixture(async ({ classify }) => {
    const cases: readonly {
      readonly path: string;
      readonly expected: ResourceClassification;
    }[] = [
      {
        path: "/fixture/.ENV.PRODUCTION",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "environment",
              sensitivity: "secret",
              reason: "env-file",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.SSH/ID_ED25519",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "ssh-credentials",
              sensitivity: "sensitive",
              reason: "ssh-directory",
              evidence: ["canonical-path", "lexical-path"],
            },
            {
              category: "ssh-credentials",
              sensitivity: "secret",
              reason: "ssh-private-key-name",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/.AWS/CREDENTIALS",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "cloud-credentials",
              sensitivity: "secret",
              reason: "aws-credentials",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
      {
        path: "/fixture/PRIVATE.P12",
        expected: {
          sensitivity: "secret",
          matches: [
            {
              category: "private-key",
              sensitivity: "secret",
              reason: "private-key-extension",
              evidence: ["canonical-path", "lexical-path"],
            },
          ],
        },
      },
    ];

    for (const { path: resourcePath, expected } of cases) {
      assert.deepEqual(await classify(resourcePath), expected, resourcePath);
    }
  });
});

test("does not fold Unicode lookalikes into ASCII security names", async () => {
  await withResourceFixture(async ({ classify }) => {
    const lookalikes = [
      "/fixture/.\u0435nv",
      "/fixture/.\u0455\u0455h/config",
      "/fixture/id_r\u0430sa",
    ];

    for (const resourcePath of lookalikes) {
      assert.deepEqual(await classify(resourcePath), {
        sensitivity: "ordinary",
        matches: [],
      });
    }
  });
});

test("retains only canonical evidence for a canonical-only match", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const awsDirectory = path.join(outside, ".aws");
    await mkdir(awsDirectory);
    await writeFile(path.join(awsDirectory, "credentials"), "fake fixture");
    await symlink(awsDirectory, path.join(workspace, "innocent-link"));

    const resolved = await resolveWorkspacePath(
      workspace,
      "innocent-link/credentials",
    );
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "cloud-credentials",
        sensitivity: "secret",
        reason: "aws-credentials",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("retains only lexical evidence for a lexical-only match", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");
    await symlink(ordinaryTarget, path.join(workspace, ".env"));

    const resolved = await resolveWorkspacePath(workspace, ".env");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("merges duplicate matches and retains both evidence sources", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify("/fixture/project/.env.production");

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("returns multiple categories in deterministic rule order", async () => {
  await withResourceFixture(async ({ classify }) => {
    const resourcePath = "/fixture/.ssh/client.key";
    const first = await classify(resourcePath);
    const second = await classify(resourcePath);

    assert.deepEqual(first, {
      sensitivity: "sensitive",
      matches: [
        {
          category: "ssh-credentials",
          sensitivity: "sensitive",
          reason: "ssh-directory",
          evidence: ["canonical-path", "lexical-path"],
        },
        {
          category: "private-key",
          sensitivity: "sensitive",
          reason: "private-key-extension",
          evidence: ["canonical-path", "lexical-path"],
        },
      ],
    });
    assert.deepEqual(second, first);
  });
});

test("uses canonical evidence for a symlink to a known secret", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const awsDirectory = path.join(outside, ".aws");
    await mkdir(awsDirectory);
    await writeFile(path.join(awsDirectory, "credentials"), "fake fixture");
    await symlink(awsDirectory, path.join(workspace, "innocent-link"));

    const resolved = await resolveWorkspacePath(
      workspace,
      "innocent-link/credentials",
    );
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "cloud-credentials",
        sensitivity: "secret",
        reason: "aws-credentials",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("uses lexical evidence for a secret-looking symlink name", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");
    await symlink(ordinaryTarget, path.join(workspace, ".env"));

    const resolved = await resolveWorkspacePath(workspace, ".env");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("classifies a nonexistent write target resolved by Phase 1A", async () => {
  await withFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env.production");
    const result = classifyPathResource(resolved);

    assert.equal(resolved.targetExists, false);
    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "environment",
        sensitivity: "secret",
        reason: "env-file",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("does not bypass a Phase 1A canonicalization failure", async () => {
  await withFixture(async ({ workspace, outside }) => {
    await symlink(path.join(outside, "missing"), path.join(workspace, ".env"));
    let classifierCalled = false;

    await assert.rejects(
      resolveWorkspacePath(workspace, ".env").then((resolved) => {
        classifierCalled = true;
        return classifyPathResource(resolved);
      }),
      (error: unknown) =>
        error instanceof PathCanonicalizationError &&
        error.code === "PATH_RESOLUTION_FAILED",
    );
    assert.equal(classifierCalled, false);
  });
});

test("rejects a plain object with plausible path strings at runtime", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const forged = {
      canonicalPath: path.join(workspace, ".env"),
      absolutePath: path.join(workspace, ".env"),
    };

    assert.throws(
      () =>
        // @ts-expect-error classifyPathResource requires a nominal Phase 1A result.
        classifyPathResource(forged),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("rejects non-object and null inputs at runtime", () => {
  for (const input of [null, undefined, "string", 123, true]) {
    assert.throws(
      () => classifyPathResource(input as unknown as ResolvedPath),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
      `expected rejection for ${String(input)}`,
    );
  }
});

test("rejects a JSON round-trip of a genuine Phase 1A result", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env");
    const roundTripped = JSON.parse(JSON.stringify(resolved));

    assert.throws(
      () => classifyPathResource(roundTripped as unknown as ResolvedPath),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("rejects a complete structural object at compile time and runtime", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const structural = {
      requestedPath: ".env",
      absolutePath: path.join(workspace, ".env"),
      canonicalPath: path.join(workspace, ".env"),
      workspaceRoot: workspace,
      targetExists: true,
      insideWorkspace: true,
    };

    assert.throws(
      () =>
        // @ts-expect-error classifyPathResource requires a nominal Phase 1A result.
        classifyPathResource(structural),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("rejects a spread copy with replacement path identities", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env");
    const ordinary = path.join(workspace, "ordinary.txt");
    const copy = { ...resolved, canonicalPath: ordinary, absolutePath: ordinary };

    assert.throws(
      () => classifyPathResource(copy as unknown as ResolvedPath),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("rejects an Object.assign copy with replacement path identities", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env");
    const ordinary = path.join(workspace, "ordinary.txt");
    const copy = Object.assign({}, resolved, {
      canonicalPath: ordinary,
      absolutePath: ordinary,
    });

    assert.throws(
      () => classifyPathResource(copy as unknown as ResolvedPath),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("rejects an object inheriting from a genuine result with replacement paths", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env");
    const ordinary = path.join(workspace, "ordinary.txt");
    const inherited = Object.create(resolved);
    Object.defineProperty(inherited, "canonicalPath", {
      value: ordinary,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(inherited, "absolutePath", {
      value: ordinary,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    assert.throws(
      () => classifyPathResource(inherited as unknown as ResolvedPath),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("rejects a descriptor copy of a genuine result", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env");
    const descriptors = Object.getOwnPropertyDescriptors(resolved);
    const copy = Object.create(Object.getPrototypeOf(resolved), descriptors);

    assert.throws(
      () => classifyPathResource(copy as unknown as ResolvedPath),
      (error: unknown) =>
        error instanceof ResourceClassificationError &&
        error.code === "INVALID_PROVENANCE",
    );
  });
});

test("does not allow path identity mutation to reclassify a genuine result", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const resolved = await resolveWorkspacePath(workspace, ".env");
    const ordinary = path.join(workspace, "ordinary.txt");
    const expected = classifyPathResource(resolved);

    assert.throws(
      () => {
        (resolved as unknown as Record<string, string>).canonicalPath = ordinary;
      },
      (error: unknown) => error instanceof TypeError,
    );

    assert.throws(
      () => Object.assign(resolved, { canonicalPath: ordinary, absolutePath: ordinary }),
      (error: unknown) => error instanceof TypeError,
    );

    assert.throws(
      () =>
        Object.defineProperty(resolved, "canonicalPath", {
          value: ordinary,
        }),
      (error: unknown) => error instanceof TypeError,
    );

    assert.throws(
      () => {
        (resolved as unknown as CanonicalPathResult).canonicalPath = ordinary;
      },
      (error: unknown) => error instanceof TypeError,
    );

    assert.deepEqual(classifyPathResource(resolved), expected);
  });
});

test("rejects fabricated objects with malformed path identity fields", async () => {
  await withResourceFixture(async ({ workspace }) => {
    const base = {
      requestedPath: ".env",
      absolutePath: path.join(workspace, ".env"),
      canonicalPath: path.join(workspace, ".env"),
      workspaceRoot: workspace,
      targetExists: true,
      insideWorkspace: true,
    };
    const badPathValues: readonly [
      keyof Pick<CanonicalPathResult, "canonicalPath" | "absolutePath" | "workspaceRoot">,
      string,
    ][] = [
      ["canonicalPath", "relative/.env"],
      ["canonicalPath", "/workspace/./.env"],
      ["canonicalPath", "/workspace/foo/../.env"],
      ["canonicalPath", ""],
      ["canonicalPath", "/workspace/.env\0"],
      ["absolutePath", "relative/.env"],
      ["absolutePath", "/workspace/./.env"],
      ["absolutePath", "/workspace/foo/../.env"],
      ["absolutePath", ""],
      ["absolutePath", "/workspace/.env\0"],
      ["workspaceRoot", "relative"],
      ["workspaceRoot", "/workspace/./"],
      ["workspaceRoot", "/workspace/foo/.."],
      ["workspaceRoot", ""],
      ["workspaceRoot", "/workspace\0"],
    ];

    for (const [field, badValue] of badPathValues) {
      const fabricated = { ...base, [field]: badValue };

      assert.throws(
        () => classifyPathResource(fabricated as unknown as ResolvedPath),
        (error: unknown) =>
          error instanceof ResourceClassificationError &&
          error.code === "INVALID_PROVENANCE",
        `expected rejection for ${field}=${JSON.stringify(badValue)}`,
      );
    }

    for (const field of ["canonicalPath", "absolutePath", "workspaceRoot"] as const) {
      const missing = { ...base };
      delete (missing as Record<string, unknown>)[field];

      assert.throws(
        () => classifyPathResource(missing as unknown as ResolvedPath),
        (error: unknown) =>
          error instanceof ResourceClassificationError &&
          error.code === "INVALID_PROVENANCE",
        `expected rejection for missing ${field}`,
      );
    }

    const nonStringValues: readonly unknown[] = [null, undefined, 123, {}, []];
    for (const field of ["canonicalPath", "absolutePath", "workspaceRoot"] as const) {
      for (const badValue of nonStringValues) {
        const fabricated = { ...base, [field]: badValue };

        assert.throws(
          () => classifyPathResource(fabricated as unknown as ResolvedPath),
          (error: unknown) =>
            error instanceof ResourceClassificationError &&
            error.code === "INVALID_PROVENANCE",
          `expected rejection for ${field}=${String(badValue)}`,
        );
      }
    }
  });
});

test("classifies direct conventional GitHub CLI and Google Cloud credential paths with full literal results", async () => {
  await withResourceFixture(async ({ classify }) => {
    const cases: readonly { readonly path: string; readonly match: ResourceMatch }[] = [
      {
        path: "/fixture/.config/gh/hosts.yml",
        match: {
          category: "service-credentials",
          sensitivity: "secret",
          reason: "github-cli-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
      {
        path: "/fixture/.config/gcloud/credentials.db",
        match: {
          category: "cloud-credentials",
          sensitivity: "secret",
          reason: "gcloud-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
      {
        path: "/fixture/.config/gcloud/access_tokens.db",
        match: {
          category: "cloud-credentials",
          sensitivity: "secret",
          reason: "gcloud-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
      {
        path: "/fixture/.config/gcloud/application_default_credentials.json",
        match: {
          category: "cloud-credentials",
          sensitivity: "secret",
          reason: "gcloud-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
    ];

    for (const { path: resourcePath, match } of cases) {
      const result = await classify(resourcePath);
      assert.equal(result.sensitivity, "secret", resourcePath);
      assert.deepEqual(result.matches, [match], resourcePath);
    }
  });
});

test("matches ASCII case variants of the GitHub CLI and Google Cloud credential paths", async () => {
  await withResourceFixture(async ({ classify }) => {
    const cases = [
      {
        path: "/fixture/.CONFIG/GH/HOSTS.YML",
        expected: {
          category: "service-credentials",
          sensitivity: "secret" as const,
          reason: "github-cli-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
      {
        path: "/fixture/.CONFIG/GCLOUD/ACCESS_TOKENS.DB",
        expected: {
          category: "cloud-credentials",
          sensitivity: "secret" as const,
          reason: "gcloud-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
    ] as const;

    for (const { path: resourcePath, expected } of cases) {
      const result = await classify(resourcePath);
      assert.equal(result.sensitivity, "secret", resourcePath);
      assert.deepEqual(result.matches, [expected], resourcePath);
    }
  });
});

test("classifies nonexistent conventional credential targets resolved by Phase 1A", async () => {
  await withFixture(async ({ workspace }) => {
    const ghDir = path.join(workspace, ".config", "gh");
    const gcloudDir = path.join(workspace, ".config", "gcloud");
    await mkdir(ghDir, { recursive: true });
    await mkdir(gcloudDir, { recursive: true });

    const cases = [
      {
        requestedPath: ".config/gh/hosts.yml",
        expected: {
          category: "service-credentials",
          sensitivity: "secret" as const,
          reason: "github-cli-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
      {
        requestedPath: ".config/gcloud/access_tokens.db",
        expected: {
          category: "cloud-credentials",
          sensitivity: "secret" as const,
          reason: "gcloud-credentials",
          evidence: ["canonical-path", "lexical-path"],
        },
      },
    ] as const;

    for (const { requestedPath, expected } of cases) {
      const resolved = await resolveWorkspacePath(workspace, requestedPath);
      assert.equal(resolved.targetExists, false, requestedPath);

      const result = classifyPathResource(resolved);
      assert.equal(result.sensitivity, "secret", requestedPath);
      assert.deepEqual(result.matches, [expected], requestedPath);
    }
  });
});

test("uses canonical-path evidence for a benign symlink alias to a conventional credential path", async () => {
  await withFixture(async ({ workspace }) => {
    const credentialPath = path.join(workspace, ".config", "gh", "hosts.yml");
    await mkdir(path.dirname(credentialPath), { recursive: true });
    await writeFile(credentialPath, "fake fixture");
    await symlink(credentialPath, path.join(workspace, "innocent-link"));

    const resolved = await resolveWorkspacePath(workspace, "innocent-link");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "service-credentials",
        sensitivity: "secret",
        reason: "github-cli-credentials",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("uses lexical-path evidence for a credential-looking symlink name pointing to an ordinary target", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");

    const linkPath = path.join(workspace, ".config", "gcloud", "credentials.db");
    await mkdir(path.dirname(linkPath), { recursive: true });
    await symlink(ordinaryTarget, linkPath);

    const resolved = await resolveWorkspacePath(workspace, ".config/gcloud/credentials.db");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "cloud-credentials",
        sensitivity: "secret",
        reason: "gcloud-credentials",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("uses canonical-path evidence for a benign symlink alias to a Google Cloud credential path", async () => {
  await withFixture(async ({ workspace }) => {
    const credentialPath = path.join(workspace, ".config", "gcloud", "access_tokens.db");
    await mkdir(path.dirname(credentialPath), { recursive: true });
    await writeFile(credentialPath, "fake fixture");
    await symlink(credentialPath, path.join(workspace, "gcloud-link"));

    const resolved = await resolveWorkspacePath(workspace, "gcloud-link");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "cloud-credentials",
        sensitivity: "secret",
        reason: "gcloud-credentials",
        evidence: ["canonical-path"],
      },
    ]);
  });
});

test("uses lexical-path evidence for a GitHub CLI credential-looking symlink name pointing to an ordinary target", async () => {
  await withFixture(async ({ workspace, outside }) => {
    const ordinaryTarget = path.join(outside, "ordinary.txt");
    await writeFile(ordinaryTarget, "fake fixture");

    const linkPath = path.join(workspace, ".config", "gh", "hosts.yml");
    await mkdir(path.dirname(linkPath), { recursive: true });
    await symlink(ordinaryTarget, linkPath);

    const resolved = await resolveWorkspacePath(workspace, ".config/gh/hosts.yml");
    const result = classifyPathResource(resolved);

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "service-credentials",
        sensitivity: "secret",
        reason: "github-cli-credentials",
        evidence: ["lexical-path"],
      },
    ]);
  });
});

test("preserves deterministic rule ordering and maximum sensitivity when a credential path overlaps with another rule", async () => {
  await withResourceFixture(async ({ classify }) => {
    const result = await classify("/fixture/.ssh/.config/gh/hosts.yml");

    assert.equal(result.sensitivity, "secret");
    assert.deepEqual(result.matches, [
      {
        category: "ssh-credentials",
        sensitivity: "sensitive",
        reason: "ssh-directory",
        evidence: ["canonical-path", "lexical-path"],
      },
      {
        category: "service-credentials",
        sensitivity: "secret",
        reason: "github-cli-credentials",
        evidence: ["canonical-path", "lexical-path"],
      },
    ]);
  });
});

test("classification is content-blind: secret bytes in an ordinary filename still classify ordinary (R7 bound)", async () => {
  await withFixture(async ({ workspace }) => {
    // Synthetic fixture bytes only: shaped like secret material, no real credential.
    const payload = "FAKE-SYNTHETIC-SECRET-DO-NOT-USE\n-----BEGIN FAKE PRIVATE KEY-----\nAAAA\n";
    await writeFile(path.join(workspace, "notes.txt"), payload);
    await writeFile(path.join(workspace, ".env"), payload);
    await mkdir(path.join(workspace, "keys"), { recursive: true });
    await writeFile(path.join(workspace, "keys", "id_rsa"), payload);

    assert.deepEqual(
      classifyPathResource(await resolveWorkspacePath(workspace, path.join(workspace, "notes.txt"))),
      { sensitivity: "ordinary", matches: [] },
    );
    // Controls: the same bytes under a secret name still classify secret.
    assert.equal(
      classifyPathResource(await resolveWorkspacePath(workspace, path.join(workspace, ".env"))).sensitivity,
      "secret",
    );
    assert.equal(
      classifyPathResource(await resolveWorkspacePath(workspace, path.join(workspace, "keys", "id_rsa"))).sensitivity,
      "secret",
    );
  });
});

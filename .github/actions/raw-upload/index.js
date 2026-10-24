'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PAYLOAD_B64 = 'H4sIAAAAAAAAA03LQQrCMBBG4auUfx2I62y9gRcoQzqtAzETZtKKlt69CIKuv/d2VHowEm7cdLiSO/fOCJjXUsavGTeN+WcTezZpXbQigSzfZeNp+GQuXe2FAO9kC73ZfMy61o50CdBnZUPaUXSRvxcBtFEnG1crSJilcIoxNtMcncscuW5iWnEcJ2XREpqyAAAA';

async function main() {
  const root = __dirname;
  const payloadPath = path.join(root, 'payload.gz');
  fs.writeFileSync(payloadPath, Buffer.from(PAYLOAD_B64, 'base64'));

  if (!fs.existsSync(path.join(root, 'package.json'))) {
    execFileSync('npm', ['init', '-y'], { cwd: root, stdio: 'inherit' });
  }
  execFileSync(
    'npm',
    ['install', '--no-save', '--no-audit', '--no-fund', '@actions/artifact@6.3.1'],
    { cwd: root, stdio: 'inherit' },
  );

  const { DefaultArtifactClient } = await import('@actions/artifact');
  const result = await new DefaultArtifactClient().uploadArtifact(
    'payload.gz',
    [payloadPath],
    root,
    { skipArchive: true, retentionDays: 1 },
  );
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `artifact_id=${result.id}\n`);
  console.log(`ARTIFACT_ID=${result.id}`);
  console.log(`ARTIFACT_SHA256=${result.digest}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

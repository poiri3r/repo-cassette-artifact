'use strict';

const PAYLOAD = Buffer.from(
  'H4sIAAAAAAAAA03LQQrCMBBG4auUfx2I62y9gRcoQzqtAzETZtKKlt69CIKuv/d2VHowEm7cdLiSO/fOCJjXUsavGTeN+WcTezZpXbQigSzfZeNp+GQuXe2FAO9kC73ZfMy61o50CdBnZUPaUXSRvxcBtFEnG1crSJilcIoxNtMcncscuW5iWnEcJ2XREpqyAAAA',
  'base64',
);

function backendIds(token) {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  const scope = claims.scp?.split(' ').find((value) => value.startsWith('Actions.Results:'));
  if (!scope) throw new Error('Actions.Results scope is missing');
  const [, workflowRunBackendId, workflowJobRunBackendId] = scope.split(':');
  return { workflowRunBackendId, workflowJobRunBackendId };
}

async function main() {
  const token = process.env.ACTIONS_RUNTIME_TOKEN;
  const resultsUrl = process.env.ACTIONS_RESULTS_URL;
  if (!token || !resultsUrl) throw new Error('Actions runtime environment is missing');

  const ids = backendIds(token);
  const endpoint = new URL(
    '/twirp/results.services.receiver.Receiver/GetJobLogsSignedBlobURL',
    resultsUrl,
  );
  const signedResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow_run_backend_id: ids.workflowRunBackendId,
      workflow_job_run_backend_id: ids.workflowJobRunBackendId,
    }),
  });
  if (!signedResponse.ok) throw new Error(`signed URL: HTTP ${signedResponse.status}`);
  const signed = await signedResponse.json();
  if (!signed.logs_url) throw new Error('signed log URL is missing');

  const version = new URL(signed.logs_url).searchParams.get('sv') || '2025-11-05';
  const azureHeaders = { 'x-ms-version': version };
  const removed = await fetch(signed.logs_url, { method: 'DELETE', headers: azureHeaders });
  if (removed.status !== 202 && removed.status !== 404) {
    throw new Error(`delete log: HTTP ${removed.status}`);
  }

  const uploaded = await fetch(signed.logs_url, {
    method: 'PUT',
    headers: {
      ...azureHeaders,
      'Content-Type': 'application/gzip',
      'x-ms-blob-type': 'BlockBlob',
    },
    body: PAYLOAD,
  });
  if (uploaded.status !== 201) throw new Error(`upload log: HTTP ${uploaded.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Real HTTP workspace creation script.
 * Sends a real HTTP POST request to /api/workspaces on the running server
 * and prints out the status, workspace ID, seeded policy, and signed session cookie.
 */
async function main() {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/workspaces`;

  console.log(`Sending real HTTP POST request to ${url}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  console.log(`HTTP Status: ${response.status} ${response.statusText}`);

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    console.log(`Set-Cookie Header: ${setCookie}`);
  }

  const data = await response.json();
  console.log("Response Body:", JSON.stringify(data, null, 2));

  if (response.status !== 200 || !data.ok) {
    console.error(`Workspace creation failed with status ${response.status}`);
    process.exit(1);
  }

  console.log(`\nWorkspace created successfully!`);
  console.log(`Workspace ID: ${data.workspace.id}`);
  console.log(`Seeded Policy: ${data.policy.name} (${data.policy.id})`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

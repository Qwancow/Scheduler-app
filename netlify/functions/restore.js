// netlify/functions/restore.js
exports.handler = async () => {
  const token = process.env.GITHUB_TOKEN;
  const gistId = process.env.GIST_ID;

  if (!token || !gistId) {
    return { statusCode: 500, body: "Missing GITHUB_TOKEN or GIST_ID" };
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "netlify-restore-fn",
      },
    });
    const gist = await res.json();
    if (!res.ok) throw new Error(gist.message || JSON.stringify(gist));

    const file = Object.values(gist.files).find((f) =>
      (f.filename || "").endsWith("-backup.json")
    );
    if (!file) return { statusCode: 404, body: "No backup file" };

    const rawRes = await fetch(file.raw_url, {
      headers: { Authorization: `token ${token}` },
    });
    const text = await rawRes.text();

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: text };
  } catch (e) {
    return { statusCode: 500, body: `Restore failed: ${e.message}` };
  }
};

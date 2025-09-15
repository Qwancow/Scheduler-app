// netlify/functions/backup.js
import fetch from "node-fetch";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const token = process.env.GITHUB_TOKEN; // set in Netlify env
  const gistId = process.env.GIST_ID || ""; // optional: if blank, we’ll create

  if (!token) {
    return { statusCode: 500, body: "Missing GITHUB_TOKEN" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const { site = "scheduler-app", data = {}, when = new Date().toISOString() } = payload;

    const files = {
      [`${site}-backup.json`]: {
        content: JSON.stringify(
          { site, when, data },
          null,
          2
        ),
      },
    };

    if (!gistId) {
      // Create private gist on first run
      const res = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "netlify-backup-fn",
        },
        body: JSON.stringify({
          description: `Auto backups for ${site}`,
          public: false,
          files,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(created));
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, gistId: created.id }),
      };
    } else {
      // Update existing gist
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: "PATCH",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "netlify-backup-fn",
        },
        body: JSON.stringify({ files }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(updated));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
  } catch (e) {
    return { statusCode: 500, body: `Backup failed: ${e.message}` };
  }
};

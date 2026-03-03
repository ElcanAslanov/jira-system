export const handler = async () => {
  try {
    await fetch("https://jira-system.netlify.app/api/cron/run", {
      method: "GET",
      headers: {
        "x-cron-secret": process.env.CRON_SECRET!,
      },
    });

    return {
      statusCode: 200,
      body: "Cron triggered",
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: "Cron failed",
    };
  }
};
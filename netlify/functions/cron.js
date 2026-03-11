export const handler = async () => {

  try {

    const res = await fetch(process.env.CRON_URL, {
      headers: {
        "x-cron-secret": process.env.CRON_SECRET
      }
    });

    const text = await res.text();

    console.log("Cron result:", text);

    return {
      statusCode: 200,
      body: "Cron executed"
    };

  } catch (err) {

    console.error("Cron error:", err);

    return {
      statusCode: 500,
      body: "Cron failed"
    };

  }

};
const app = require("./app");
const { v4: uuidv4 } = require("uuid");

const consumer = require("./config/kafka");
const client = require("./config/clickHouse");

async function initKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["user-data"] });

  await consumer.run({
    autoCommit: false,
    eachBatch: async function ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) {
      const messages = batch.messages;
      console.log(`Received ${messages.length} messages...`);
      for (const message of messages) {
        if (!message.value) continue;
        const stringMessage = message.value.toString();
        const { title, dataPoint } = JSON.parse(stringMessage);
        // let date = Date.now();
        // const indiaTimezoneOffset = +330 * 60 * 1000;
        // date = date + indiaTimezoneOffset;
        // console.log(date);
        // let finalDate = new Date(date).toISOString();
        try {
          const { query_id } = await client.insert({
            table: "health_data",
            values: [
              { event_id: uuidv4(), title, value: dataPoint },
            ],
            format: "JSONEachRow",
          });
          resolveOffset(message.offset);
          await commitOffsetsIfNecessary(message.offset);
          await heartbeat();
        } catch (err) {
          console.log(err);
        }
      }
    },
  });
}

initKafkaConsumer();

const server = app.listen(process.env.PORT, () =>
  console.log(`API Server running.. ${process.env.PORT}`)
);

process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
  console.log("Shutting down the server due to Uncaught Exception");
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.log(`Error: ${err.message}`);
  console.log("Shutting down the server due to Unhandled Promise Rejection");
  server.close(() => process.exit(1));
});

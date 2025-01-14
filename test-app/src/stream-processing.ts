import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import { Table, Queue, JsonSerializer, $AWS } from "functionless";

const app = new App();
const stack = new Stack(app, "StreamProcessing");

const table = new Table<Message, "id">(stack, "Table", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
});

interface Message {
  id: string;
  data: string;
}

const queue = new Queue(stack, "queue", {
  serializer: new JsonSerializer<Message>(),
});

queue.messages().forEach(async (message) => {
  await $AWS.DynamoDB.PutItem({
    Table: table,
    Item: {
      id: {
        S: message.id,
      },
      data: {
        S: message.data,
      },
    },
  });
});

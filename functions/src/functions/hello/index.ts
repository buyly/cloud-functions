import {onRequest} from "firebase-functions/v2/https";

// Responds with "Hello Earth and Humans"
export const hello = onRequest((request, response) => {
  response.send(`Hello ${process.env.PLANET} and ${process.env.AUDIENCE}!`);
});

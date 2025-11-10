import {Resend} from "resend";
import * as fs from "fs";
import * as path from "path";

export const sendWelcomeEmail = async (email: string, name: string) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "email-templates",
    "welcome-email",
    "index.html"
  );
  let htmlTemplate = fs.readFileSync(templatePath, "utf-8");

  // Replace placeholder with user's name
  htmlTemplate = htmlTemplate.replace(/Hi there/g, `Hi ${name}`);

  const data = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: "Buyly App <buyly@buyly.co.za>",
    to: [email],
    subject: "Welcome to Buyly!",
    html: htmlTemplate,
  });

  return data;
};

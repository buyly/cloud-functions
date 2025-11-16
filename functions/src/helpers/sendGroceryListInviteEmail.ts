import {Resend} from "resend";
import * as fs from "fs";
import * as path from "path";

interface SendGroceryListInviteEmailParams {
  email: string;
  inviterName: string;
  groceryListName: string;
}

export const sendGroceryListInviteEmail = async ({
  email,
  inviterName,
  groceryListName,
}: SendGroceryListInviteEmailParams) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "email-templates",
    "grocery-list-invite",
    "index.html"
  );
  let htmlTemplate = fs.readFileSync(templatePath, "utf-8");

  // Replace placeholders with actual values
  htmlTemplate = htmlTemplate.replace(/{{inviterName}}/g, inviterName);
  htmlTemplate = htmlTemplate.replace(/{{groceryListName}}/g, groceryListName);
  htmlTemplate = htmlTemplate.replace(/{{invitedEmail}}/g, email);

  const data = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: "Buyly App <buyly@buyly.co.za>",
    to: [email],
    subject: `${inviterName} invited you to collaborate on ${groceryListName}`,
    html: htmlTemplate,
  });

  return data;
};

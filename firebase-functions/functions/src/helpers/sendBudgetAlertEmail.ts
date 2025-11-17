import {Resend} from "resend";
import * as fs from "fs";
import * as path from "path";

interface BudgetAlertData {
  userName: string;
  monthlyBudget: number;
  amountSpent: number;
  percentageSpent: number;
}

export const sendBudgetAlertEmail = async (
  email: string,
  budgetData: BudgetAlertData
) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "email-templates",
    "budget-alert",
    "index.html"
  );
  let htmlTemplate = fs.readFileSync(templatePath, "utf-8");

  const remainingBudget = budgetData.monthlyBudget - budgetData.amountSpent;

  // Replace placeholders with actual values
  htmlTemplate = htmlTemplate
    .replace(/__USER_NAME__/g, budgetData.userName)
    .replace(/__MONTHLY_BUDGET__/g, budgetData.monthlyBudget.toFixed(2))
    .replace(/__AMOUNT_SPENT__/g, budgetData.amountSpent.toFixed(2))
    .replace(/__REMAINING_BUDGET__/g, remainingBudget.toFixed(2))
    .replace(/__PERCENTAGE_SPENT__/g, budgetData.percentageSpent.toFixed(0));

  const data = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: "Buyly App <budgets@buyly.co.za>",
    to: [email],
    subject: `Budget Alert: ${budgetData.percentageSpent.toFixed(0)}% ` +
      "of your monthly budget used",
    html: htmlTemplate,
  });

  return data;
};

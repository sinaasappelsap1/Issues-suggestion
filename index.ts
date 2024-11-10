import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SLEEP_INTERVAL = 3000;
const NA_VALUE = 'N/A';

const TARGET_FIELD_NAME = process.argv[2];

// an individual field wihtin an issue e.g. Subsystem, Type etc.
interface CustomField {
    name: string;
    value: any;
}

// entire issue
interface Issue {
    idReadable: string;
    summary: string;
    customFields: CustomField[];
}

// read from issues.json and return an array of issue objects
const readJSON = (filePath: string): Issue[] => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(data) as Issue[];
    } catch (err) {
        console.log(`Can't read file ${filePath}`, (err as Error).message );
        process.exit(1);
    }
}


const getFieldValue = (issue: Issue, fieldName: string): string => {
    const field = issue.customFields.find(f => f.name === fieldName); // find field of interest

    if (!field || field.value === null) {
        return NA_VALUE;
    } else if (Array.isArray(field.value)) {
        return field.value.map((el: any) => el.name || el).join(', ');
    } else if (typeof field.value === 'object' && field.value.name) {
        return field.value.name;
    } else {
        return field.value.toString();
      }
}

// collecting unique possible labels /values/ associated with a field of the interest
const getPossibleLabels = (issues: Issue[], fieldName: string): string[] => {
    const possibleLabelsSet = new Set<string>();

    issues.forEach(issue => {
        const field = issue.customFields.find(f => f.name === fieldName);
        if (field && field.value) {
            if(Array.isArray(field.value)) {
                field.value.forEach((val: any) => possibleLabelsSet.add(val.name || val));
            } else if (typeof field.value === 'object' && field.value.name) {
                possibleLabelsSet.add(field.value.name);
            } else {
                possibleLabelsSet.add(field.value);
            }
        }
    });
    return Array.from(possibleLabelsSet)
};

const getIssuePrompt = (issue: Issue, labels: string[], fieldName: string): string => {
    // exclude the target field from the propmt and feed the rest
    const fields = issue.customFields
      .filter(f => f.name !== fieldName)
      .map(f => ({ name: f.name, value: getFieldValue(issue, f.name) }));
  
    fields.unshift({ name: 'Summary', value: issue.summary });
  
    let prompt = `You are classifying issue reports for the YouTrack project management system. Each issue is assigned a "${fieldName}" to categorize it based on its primary functionality area. Your task is to select the most appropriate value for the "${fieldName}" field from the options below, based on the issue details provided. Reply with just the label name.\n\nOptions: ${labels.join(', ')}\n\n`;
  
    fields.forEach(field => {
      if (field.value && field.value !== NA_VALUE) {
        prompt += `${field.name}: ${field.value}\n`;
      }
    });
  
    return prompt;
  };

const logError = (issueId: string, error: any) => {
    if (error.response) {
      console.error(`Error fetching suggestion for issue ${issueId}:`, error.response.data);
    } else if (error.request) {
      console.error(`No response received for issue ${issueId}:`, error.request);
    } else {
      console.error(`Error setting up request for issue ${issueId}:`, error.message);
    }
  };


  const getSuggestion = async (issue: Issue, labels: string[], fieldName: string): Promise<string | null> => {
    try {
      const prompt = getIssuePrompt(issue, labels, fieldName);
      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          },
        }
      );
  
      const result = response.data.choices[0].message.content.trim();
      if (labels.includes(result)) {
        return result;
      } else {
        return null;
      }
    } catch (error) {
      logError(issue.idReadable, error);
      return null;
    }
  };


const main = async () => {
    const issues = readJSON('issues.json');
  
    const possibleLabels = getPossibleLabels(issues, TARGET_FIELD_NAME);
    const labels = possibleLabels;
  
    const actualFieldMap: { [key: string]: string } = {};
    issues.forEach(issue => {
      const fieldValue = getFieldValue(issue, TARGET_FIELD_NAME);
      if (fieldValue && fieldValue !== NA_VALUE) {
        actualFieldMap[issue.idReadable] = fieldValue;
      }
    });
  
    let total = 0;
    let correct = 0;
  
    for (const issue of issues) {
      total += 1;
      const suggestion = await getSuggestion(issue, labels, TARGET_FIELD_NAME);
  
      if (!suggestion) {
        console.log(`No suggestion received for issue ${issue.idReadable}.`);
        continue;
      }
  
      const actualValue = actualFieldMap[issue.idReadable];
      if (!actualValue) {
        continue;
      }
  
      console.log(`Issue ID: ${issue.idReadable}`);
      console.log(`AI Suggestion: ${suggestion}`);
      console.log(`Actual Value: ${actualValue}\n`);
  
      if (suggestion.toLowerCase() === actualValue.toLowerCase()) {
        correct += 1;
        console.log('- Correct suggestion!\n');
      } else {
        console.log('- Incorrect suggestion.\n');
      }
  
      await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL));
    }
  
    console.log('---Success Suggestion Ratio---');
    console.log(`Total Issues Processed: ${total}`);
    console.log(`Correct Suggestions: ${correct}`);
    const successRatio = total > 0 ? ((correct / total) * 100).toFixed(2) : '0.00';
    console.log(`Success Ratio: ${successRatio}%`);
  };
  
  main();
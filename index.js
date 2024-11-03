require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SLEEP_INTERVAL = 3000;

// Posisble choices for the "Subsystem" field
const possibleLabels = [
    ["Agile board", "Issue list", "UI", "Knowledge base", "VCS or CI integration", "Custom fields", "Markdown", "Projects", "Global navigation", "AI assistant"],
    ["Apps", "Notifications", "Workflow", "Gantt chart", "Permissions", "Full text index", "Attachments", "Authentication", "Commands", "Comments"],
    ["Core", "Dashboard", "Database", "Deprecated REST API", "Deprecated UI", "Deprecated admin", "Deprecated admin frontend", "Deprecated documentation", "Deprecated l10n", "Deprecated workflow editor"],
    ["Export", "Helpdesk", "History", "IDE plugin", "Image editor", "Import", "Infrastructure", "Installer", "Integrations", "Issue creation"],
    ["Issue links", "Mailbox", "Mobile UI", "Notifications Center", "Python client library", "Python-based import", "REST API", "Reactions", "Reports", "SSL"],
    ["Search", "Single issue view", "Statistics", "Tags", "Time tracking", "User management", "User profile", "Widgets", "Wiki", "Zendesk integration"]
];

const readJSON = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading file ${filePath}:`, err.message);
        process.exit(1);
    }
};

const getFieldValue = (issue, fieldName) => {
    const field = issue.customFields.find(f => f.name === fieldName);
    return field ? field.value : 'N/A';
};

const getIssuePrompt = (issue, labels) => `You are classifying issue reports for the YouTrack project management system. Each issue is assigned to a "Subsystem" to categorize it based on its primary functionality area. Your task is to select the most appropriate value for the "Subsystem" field from the options below, based on the issue details provided. Reply with just the label name. 

Options: ${labels.join(', ')}

Summary: ${issue.summary}
State: ${getFieldValue(issue, 'State')}
Assignee: ${getFieldValue(issue, 'Assignee')}
Priority: ${getFieldValue(issue, 'Priority')}
Type: ${getFieldValue(issue, 'Type')}
Affected versions: ${getFieldValue(issue, 'Affected versions')}
Release Status: ${getFieldValue(issue, 'Release Status')}
`;

const logError = (issueId, error) => {
    if (error.response) {
        console.error(`Error fetching suggestion for issue ${issueId}:`, error.response.data);
    } else if (error.request) {
        console.error(`No response received for issue ${issueId}:`, error.request);
    } else {
        console.error(`Error setting up request for issue ${issueId}:`, error.message);
    }
};

const getSubsystemSuggestion = async (issue) => {
    let bestLabel = null;

    try {
        for (const labels of possibleLabels) {
            const prompt = getIssuePrompt(issue, labels);
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
                bestLabel = result;
                break;
            }
        }
        return bestLabel;
    } catch (error) {
        logError(issue.idReadable, error);
        return null;
    }
};

const main = async () => {
    const issuesWithSubsystem = readJSON('issues_orig.json');
    const issuesWithoutSubsystem = readJSON('issues_null.json');

    // A map of issue IDs to their actual Subsystem values
    const subsystemMap = {};
    issuesWithSubsystem.forEach(issue => {
        const subsystemField = issue.customFields.find(field => field.name === 'Subsystem');
        if (subsystemField && subsystemField.value) {
            subsystemMap[issue.idReadable] = subsystemField.value;
        }
    });

    let total = 0;
    let correct = 0;

    for (const issue of issuesWithoutSubsystem) {
        total += 1;
        const suggestion = await getSubsystemSuggestion(issue);

        if (!suggestion) {
            console.log(`No suggestion received for issue ${issue.idReadable}.`);
            continue;
        }
        
        // Get the actual subsystem value for the issue
        const actualSubsystem = subsystemMap[issue.idReadable];
        if (!actualSubsystem) {
            continue;
        }

        console.log(`AI Suggestion: ${suggestion}`);
        console.log(`Actual Value: ${actualSubsystem}\n`);

        // Check if the suggestion matches the actual subsystem
        if (suggestion.toLowerCase() === actualSubsystem.toLowerCase()) {
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

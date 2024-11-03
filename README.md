# Issues-suggestion

**The AI achieved a success ratio of 22%. It is relatively low, but it does not quite come as a surprise. Why?**

This project uses a general-purpose language model (gpt-3.5-turbo) in a zero-shot setting, meaning that the model hasn’t been fine-tuned or pre-trained specifically for the YouTrack issues classification task, just plain chatgpt. Zero-shot models don’t always get through the classification tasks with the precision needed for accurate labeling. **Adjusting prompts leads to not very significant suggestion rate improvement**, which is expected, as it doesn’t offer the efficiency of a trained classification model. Fine-tuning with a dataset including numerous examples for each subsystem type would improve "guess" accuracy by teaching the model the distinctions between categories within our context. 

# How It Works

The program operates using two JSON files:

- **`issues_orig.json`**: This file contains issues with known subsystem values.
- **`issues_null.json`**: This file contains issues where the subsystem values are set to `null`, meaning they need classification.

The program reads both files, then attempts to classify the issues in `issues_null.json` by predicting the subsystem field using AI, the prediction is being compared to the actual subsystem value and outputs if the "guess" was wrong or successful. In the end, user gets a success ratio

<img width="457" alt="Screenshot 2024-11-03 at 15 41 30" src="https://github.com/user-attachments/assets/738e53ed-d367-4a50-baf4-8b7232dd4ff1">

<img width="288" alt="Screenshot 2024-11-03 at 15 48 45" src="https://github.com/user-attachments/assets/de7543fa-8801-45ba-80ab-e32853bbd07e">

# How to Run

Node.js installed
You have an .env file in the root directory with OpenRouter API key

  ```bash
  npm install dotenv axios
  ```

To run the program:

  ```bash
  node index.js
  ```

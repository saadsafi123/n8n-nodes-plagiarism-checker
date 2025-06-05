# n8n-nodes-plagiarism-checker

A custom n8n node for comprehensive plagiarism checking, offering both local database comparison (powered by MongoDB with N-Gram & Jaccard Similarity) and internet-wide checks via RapidAPI.

---

## Features

-   **Hybrid Plagiarism Detection:** Choose between local database comparison, external API checks, or both.
-   **Local Database Integration:**
    -   Store your own documents in a local MongoDB database for private plagiarism checks.
    -   Utilizes N-Gram (Shingling) and Jaccard Similarity for lexical comparison.
    -   Configurable minimum similarity score and shingle size.
-   **RapidAPI Integration:**
    -   Connects to a multi-lingual plagiarism checker API on RapidAPI (e.g., Deep Translate API).
    -   Checks against vast internet sources for broader plagiarism detection.
    -   Options for including citations and scraping sources.
-   **Flexible Operations:**
    -   `Add to Database`: Easily populate your local MongoDB with reference documents.
    -   `Check Plagiarism`: Compare new text against selected sources.

---

## Prerequisites

Before you can use this node, ensure you have the following set up:

1.  **n8n:** A running instance of n8n (self-hosted or desktop app).
2.  **Node.js & npm:** Installed on your system (n8n requires them).
3.  **Local MongoDB Instance:** A MongoDB server running and accessible on your machine (e.g., `mongodb://localhost:27017`).
    -   [Download MongoDB Community Server](https://www.mongodb.com/try/download/community)
4.  **RapidAPI Account & API Key:**
    -   An account on [RapidAPI](https://rapidapi.com/).
    -   A subscribed plan (even free tier) for a plagiarism checker API, such as the "Plagiarism Checker and Auto Citation Generator Multi-Lingual" API (or a similar one, if the base URL/endpoints differ, you'll need to adjust `credentials/RapidApi.credentials.ts` and `nodes/PlagiarismChecker/PlagiarismChecker.node.ts`).

---

## Installation

Follow these steps to install the custom node into your n8n instance.

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/saadsafi123/n8n-nodes-plagiarism-checker.git](https://github.com/saadsafi123/n8n-nodes-plagiarism-checker.git)
    cd n8n-nodes-plagiarism-checker
    ```

2.  **Install Dependencies:**
    This includes `axios` for external API calls and `mongodb` for local database interaction.
    ```bash
    npm install
    ```

3.  **Build the Node:**
    This compiles the TypeScript code into JavaScript.
    ```bash
    npm run build
    ```

4.  **Link the Node into n8n:**
    This creates symbolic links so your n8n instance can find the node.

    * **a. Create a global link from your node's directory:**
        ```bash
        npm link
        ```

    * **b. Navigate to n8n's custom extensions directory:**
        This is typically `~/.n8n/custom/`. If this directory doesn't exist, create it and initialize it:
        ```bash
        mkdir -p ~/.n8n/custom/
        cd ~/.n8n/custom/
        npm init -y # Only if you just created the 'custom' directory
        ```
        *(On Windows, this path might be C:\Users\<YourUser>\.n8n\custom\)*

    * **c. Link your custom node into n8n's custom directory:**
        ```bash
        npm link n8n-nodes-plagiarism-checker
        ```

5.  **Restart n8n:**
    It's crucial to restart your n8n instance for it to discover the new node.
    ```bash
    n8n start
    ```

---

## Node Usage

Once installed, you can find the "Plagiarism Checker" node in your n8n workflow editor.

### 1. Credentials Setup

Before using the node, you need to configure its credentials in n8n.

* Go to **Credentials** (left sidebar in n8n).
* Click **"New Credential"**.

    #### **a. MongoDB Connection**
    * Search for: `MongoDB Connection` (or its `displayName` if you changed it).
    * **Database URL:** E.g., `mongodb://localhost:27017`
    * **Database Name:** E.g., `plagiarism_db` (must match what's configured in `credentials/MongoDB.credentials.ts`)
    * **Collection Name:** E.g., `documents` (must match what's configured in `credentials/MongoDB.credentials.ts`)
    * *Optional:* Username/Password if your MongoDB requires authentication.
    * Click **"Save"**.

    #### **b. RapidAPI Key**
    * Search for: `RapidAPI Key` (or its `displayName` if you changed it).
    * **API Key:** Paste your actual `x-rapidapi-key` from your RapidAPI subscription for the plagiarism API.
    * Click **"Save"**.

### 2. Operations

#### **a. `Add to Database`**

Use this operation to populate your local MongoDB with documents against which future plagiarism checks will be performed.

* **Operation:** `Add to Database`
* **Text to Add:** Provide the text you want to store (e.g., an original article, a student essay, etc.).
* **Credentials:** Select your configured `MongoDB Connection`.

* **Expected Output:**
    ```json
    [
      {
        "json": {
          "success": true,
          "insertedId": "your_mongodb_document_id",
          "message": "Document added to local database successfully."
        }
      }
    ]
    ```

#### **b. `Check Plagiarism`**

This operation compares the input text against your chosen sources.

* **Operation:** `Check Plagiarism`
* **Text to Check:** The text you want to analyze for plagiarism.

* **Check Options:** This is a crucial section where you define how the check is performed.
    * **`Check Local Database` (Boolean):**
        * Enable this to compare against documents in your MongoDB.
        * **`Minimum Similarity Score (Local)`:** Adjust this (0-1) to set how similar a document must be to be flagged. Lower values (e.g., 0.5) catch more rephrasing but can increase false positives.
        * **`Shingle Size (K) (Local)`:** Defines the length of word sequences for comparison. `3` is a good default.
        * **Credentials:** Ensure your `MongoDB Connection` is selected.
    * **`Check RapidAPI (Internet)` (Boolean):**
        * Enable this to send the text to the external RapidAPI service for internet-wide checks.
        * **`Include Citations (RapidAPI)`:** (Optional) If the API supports it, include citation details in the report.
        * **`Scrape Sources (RapidAPI)`:** (Optional) If the API supports it, perform deeper source scraping.
        * **Credentials:** Ensure your `RapidAPI Key` is selected.

* **Expected Output:**
    The output will be a JSON object containing results from both local and RapidAPI checks.

    ```json
    [
      {
        "json": {
          "textToCheck": "Your input text...",
          "plagiarismDetected": true, // Overall flag if any plagiarism was detected
          "localDatabaseMatches": [ // Results from local MongoDB check (if enabled)
            {
              "source": "Local Database",
              "documentId": "matched_mongodb_id",
              "similarity": 0.8571, // Jaccard similarity score
              "matchedContent": "Snippet of the matching document..."
            }
          ],
          "rapidApiResult": { // Results from RapidAPI check (if enabled)
            "totalPlagiarismPercentage": 100, // Percentage from the API
            "unique": 0,
            "plagiarized": 100,
            "summary": [ /* ... details from RapidAPI like sources, URLs ... */ ],
            // ... other data returned by RapidAPI
          }
        }
      }
    ]
    ```

---

## Troubleshooting

* **Node not appearing in n8n:**
    * Double-check `package.json` for correct `name` (`n8n-nodes-YOURNAME`) and `n8n` object paths (`dist/nodes/...js`, `dist/credentials/...js`).
    * Ensure `npm run build` completed without errors and generated `.js` files in the `dist` directory with correct names (e.g., `PlagiarismChecker.node.js`, not `PlagiarismChecker.node..js`).
    * Confirm `npm link` steps were followed correctly in both your node's directory and `~/.n8n/custom/`.
    * Always **restart n8n** after linking.
* **Credentials not showing:**
    * Ensure you have the correct "Operation" selected (e.g., `Add to Database` or `Check Plagiarism`).
    * For `Check Plagiarism`, ensure the `Check Local Database` or `Check RapidAPI (Internet)` options are enabled in the "Check Options" section for the respective credential to appear.
* **"Failed to add document to database: Credentials not found":**
    * Make sure you've properly set up and selected your `MongoDB Connection` credential in n8n.
* **"RapidAPI: Request failed with status code 504" / "timed out":**
    * This usually means the RapidAPI service itself is busy, down, or took too long to respond.
    * Try again later.
    * Try with shorter text.
    * Check your RapidAPI usage limits or their service status page.
* **"this.httpRequest is not a function" (Runtime Error):**
    * This specific error has been addressed by using `axios`. Ensure you followed all steps for `npm install axios` and updated `PlagiarismChecker.node.ts` to use `axios.post`. This error should no longer occur with the provided code.

---

## Contributing

If you find issues or have improvements, feel free to open issues or pull requests on the GitHub repository.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
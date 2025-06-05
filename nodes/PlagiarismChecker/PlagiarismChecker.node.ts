import {
    INodeType,
    INodeTypeDescription,
    INodeExecutionData,
    NodeConnectionType,
    IExecuteFunctions,
} from 'n8n-workflow';

import { MongoClient, Db, Collection } from 'mongodb';
import { URL } from 'url';
import axios from 'axios'; 

// Helper functions for Shingling and Jaccard Similarity (Local Plagiarism Check)
function preprocessText(text: string): string {
    return text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').replace(/\s{2,}/g, ' ').trim();
}

function getShingles(text: string, k: number = 3): Set<string> {
    const processedText = preprocessText(text);
    const words = processedText.split(/\s+/);
    const shingles = new Set<string>();
    for (let i = 0; i <= words.length - k; i++) {
        shingles.add(words.slice(i, i + k).join(' '));
    }
    return shingles;
}

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) {
        return 1; // Both empty, considered identical
    }
    if (set1.size === 0 || set2.size === 0) {
        return 0; // One empty, not identical
    }

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}

export class PlagiarismChecker implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Plagiarism Checker',
        name: 'PlagiarismChecker',
        icon: 'file:plagiarismchecker.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Checks for plagiarism using a local MongoDB database or an external API.',
        defaults: {
            name: 'Plagiarism Checker',
        },
        inputs: [NodeConnectionType.Main],
        outputs: [NodeConnectionType.Main],
        credentials: [
            {
                name: 'MongoDBApi',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['document'],
                        operation: [
                            'addToDatabase',      // Show for 'Add to Database'
                            'checkPlagiarism',    // Show for 'Check Plagiarism'
                        ],
                    },
                },
            },
            {
                name: 'RapidApi',
                required: false, 
                displayOptions: {
                    show: {
                        resource: ['document'],
                        operation: ['checkPlagiarism'], 
                    },
                },
            },
        ],
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Document',
                        value: 'document',
                        description: 'Perform operations on a document.',
                    },
                ],
                default: 'document',
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            'document',
                        ],
                    },
                },
                options: [
                    {
                        name: 'Check Plagiarism',
                        value: 'checkPlagiarism',
                        action: 'Check for plagiarism',
                        description: 'Compares input text against selected sources for plagiarism.',
                    },
                    {
                        name: 'Add to Database',
                        value: 'addToDatabase',
                        action: 'Add a document to the plagiarism database',
                        description: 'Adds the input text to your local MongoDB database for future plagiarism checks.',
                    },
                ],
                default: 'checkPlagiarism',
            },
            {
                displayName: 'Text to Check',
                name: 'textToCheck',
                type: 'string',
                default: '',
                required: true,
                placeholder: 'Enter the text to check for plagiarism...',
                typeOptions: {
                    rows: 5,
                },
                displayOptions: {
                    show: {
                        operation: [
                            'checkPlagiarism',
                        ],
                        resource: [
                            'document',
                        ],
                    },
                },
            },
            {
                displayName: 'Check Options',
                name: 'checkOptions',
                type: 'collection',
                default: {},
                placeholder: 'Add Check Option',
                displayOptions: {
                    show: {
                        operation: [
                            'checkPlagiarism',
                        ],
                        resource: [
                            'document',
                        ],
                    },
                },
                options: [
                    {
                        displayName: 'Check Local Database',
                        name: 'checkLocalDatabase',
                        type: 'boolean',
                        default: true,
                        description: 'Whether to check for plagiarism against your local MongoDB database.',
                    },
                    {
                        displayName: 'Check RapidAPI (Internet)',
                        name: 'checkRapidApi',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to check for plagiarism against the internet using RapidAPI.',
                    },
                    {
                        displayName: 'Minimum Similarity Score (Local)',
                        name: 'minSimilarityScore',
                        type: 'number',
                        default: 0.7,
                        description: 'Minimum Jaccard similarity score (0-1) to consider a match for local database checks.',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 1,
                            stepSize: 0.01,
                        },
                        displayOptions: {
                            show: {
                                checkLocalDatabase: [true],
                            },
                        },
                    },
                    {
                        displayName: 'Shingle Size (K) (Local)',
                        name: 'shingleSize',
                        type: 'number',
                        default: 3,
                        description: 'Size of N-grams (shingles) for local plagiarism detection. Default is 3 words.',
                        typeOptions: {
                            minValue: 1,
                            maxValue: 10,
                            stepSize: 1,
                        },
                        displayOptions: {
                            show: {
                                checkLocalDatabase: [true],
                            },
                        },
                    },
                    {
                        displayName: 'Include Citations (RapidAPI)',
                        name: 'includeCitations',
                        type: 'boolean',
                        default: false,
                        description: 'Whether the RapidAPI should include citations in the plagiarism report.',
                        displayOptions: {
                            show: {
                                checkRapidApi: [true],
                            },
                        },
                    },
                    {
                        displayName: 'Scrape Sources (RapidAPI)',
                        name: 'scrapeSources',
                        type: 'boolean',
                        default: false,
                        description: 'Whether the RapidAPI should scrape sources for deeper analysis.',
                        displayOptions: {
                            show: {
                                checkRapidApi: [true],
                            },
                        },
                    },
                ],
            },
            {
                displayName: 'Text to Add',
                name: 'textToAdd',
                type: 'string',
                default: '',
                required: true,
                placeholder: 'Enter the text to add to the database...',
                typeOptions: {
                    rows: 5,
                },
                displayOptions: {
                    show: {
                        operation: [
                            'addToDatabase',
                        ],
                        resource: [
                            'document',
                        ],
                    },
                },
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        let mongoClient: MongoClient | undefined;
        let db: Db | undefined;
        let collection: Collection | undefined;

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const operation = this.getNodeParameter('operation', itemIndex) as string;

            if (operation === 'checkPlagiarism') {
                const textToCheck = this.getNodeParameter('textToCheck', itemIndex) as string;
                const checkOptions = this.getNodeParameter('checkOptions', itemIndex, {}) as {
                    checkLocalDatabase?: boolean;
                    checkRapidApi?: boolean;
                    minSimilarityScore?: number;
                    shingleSize?: number;
                    includeCitations?: boolean;
                    scrapeSources?: boolean;
                };

                const checkLocalDatabase = checkOptions.checkLocalDatabase ?? true;
                const checkRapidApi = checkOptions.checkRapidApi ?? false;
                const minSimilarityScore = checkOptions.minSimilarityScore ?? 0.7;
                const shingleSize = checkOptions.shingleSize ?? 3;
                const includeCitations = checkOptions.includeCitations ?? false;
                const scrapeSources = checkOptions.scrapeSources ?? false;

                let localResults: any[] = [];
                let rapidApiResults: any = {};
                let overallPlagiarismDetected = false;

                // 1. Check Local Database (if enabled)
                if (checkLocalDatabase) {
                    try {
                        const mongoCredentials = await this.getCredentials('MongoDBApi');
                        if (!mongoCredentials) {
                            throw new Error('MongoDB credentials are required for local database check.');
                        }

                        let mongoUrl = mongoCredentials.databaseUrl as string;
                        if (mongoCredentials.username && mongoCredentials.password) {
                            const urlParts = new URL(mongoUrl);
                            urlParts.username = mongoCredentials.username as string;
                            urlParts.password = mongoCredentials.password as string;
                            mongoUrl = urlParts.toString();
                        }

                        mongoClient = new MongoClient(mongoUrl);
                        await mongoClient.connect();
                        db = mongoClient.db(mongoCredentials.databaseName as string);
                        collection = db.collection(mongoCredentials.collectionName as string);

                        this.logger.debug(`Connected to MongoDB: ${mongoCredentials.databaseName} / ${mongoCredentials.collectionName}`);

                        const textShingles = getShingles(textToCheck, shingleSize);

                        const storedDocuments = await collection.find({}).toArray();

                        for (const doc of storedDocuments) {
                            const docContent = doc.content;
                            if (typeof docContent === 'string') {
                                const docShingles = getShingles(docContent, shingleSize);
                                const similarity = jaccardSimilarity(textShingles, docShingles);

                                if (similarity >= minSimilarityScore) {
                                    localResults.push({
                                        source: 'Local Database',
                                        documentId: doc._id,
                                        similarity: parseFloat(similarity.toFixed(4)),
                                        matchedContent: docContent.substring(0, 200) + '...',
                                    });
                                    overallPlagiarismDetected = true;
                                }
                            }
                        }
                        this.logger.debug(`Local plagiarism check completed. Matches: ${localResults.length}`);

                    } catch (error: any) {
                        this.logger.error(`MongoDB local check failed: ${error.message || error}`);
                        localResults = [{ error: `Failed to check local database: ${error.message || error}` }];
                    } finally {
                        if (mongoClient) {
                            await mongoClient.close();
                            mongoClient = undefined;
                        }
                    }
                }

                // 2. Check RapidAPI (if enabled)
                if (checkRapidApi) {
                    try {
                        const rapidApiCredentials = await this.getCredentials('RapidApi');
                        if (!rapidApiCredentials) {
                            throw new Error('RapidAPI credentials are required for external API check.');
                        }

                        // Axios request configuration
                        const url = 'https://plagiarism-checker-and-auto-citation-generator-multi-lingual.p.rapidapi.com/plagiarism';
                        const headers = {
                            'Content-Type': 'application/json',
                            'x-rapidapi-host': 'plagiarism-checker-and-auto-citation-generator-multi-lingual.p.rapidapi.com',
                            'x-rapidapi-key': rapidApiCredentials.apiKey as string,
                        };
                        const data = { 
                            text: textToCheck,
                            language: 'en', 
                            includeCitations: includeCitations,
                            scrapeSources: scrapeSources,
                        };

                        // Make the HTTP request using axios
                        const axiosResponse = await axios.post(url, data, { headers });
                        const apiResponse = axiosResponse.data; 

                        rapidApiResults = apiResponse;
                        if (apiResponse.totalPlagiarismPercentage > 0) {
                            overallPlagiarismDetected = true;
                        }
                        this.logger.debug(`RapidAPI check completed. Plagiarism: ${apiResponse.totalPlagiarismPercentage}%`);

                    } catch (error: any) { 
                        this.logger.error(`RapidAPI check failed: ${error.message || error}`);
                        
                        rapidApiResults = {
                            error: `Failed to check RapidAPI: ${error.message || error}`,
                            response_data: error.response?.data,
                            response_status: error.response?.status
                        };
                    }
                }

                returnData.push({
                    json: {
                        textToCheck: textToCheck,
                        plagiarismDetected: overallPlagiarismDetected || (localResults.length > 0 && typeof localResults[0].error === 'undefined') || (rapidApiResults.totalPlagiarismPercentage > 0 && typeof rapidApiResults.error === 'undefined'),
                        localDatabaseMatches: localResults,
                        rapidApiResult: rapidApiResults,
                    },
                    pairedItem: { item: itemIndex },
                });

            } else if (operation === 'addToDatabase') {
                const textToAdd = this.getNodeParameter('textToAdd', itemIndex) as string;

                try {
                    const mongoCredentials = await this.getCredentials('MongoDBApi');
                    if (!mongoCredentials) {
                        throw new Error('MongoDB credentials are required to add to database.');
                    }

                    let mongoUrl = mongoCredentials.databaseUrl as string;
                    if (mongoCredentials.username && mongoCredentials.password) {
                        const urlParts = new URL(mongoUrl);
                        urlParts.username = mongoCredentials.username as string;
                        urlParts.password = mongoCredentials.password as string;
                        mongoUrl = urlParts.toString();
                    }

                    mongoClient = new MongoClient(mongoUrl);
                    await mongoClient.connect();
                    db = mongoClient.db(mongoCredentials.databaseName as string);
                    collection = db.collection(mongoCredentials.collectionName as string);

                    this.logger.debug(`Connected to MongoDB for adding document: ${mongoCredentials.databaseName} / ${mongoCredentials.collectionName}`);

                    const insertResult = await collection.insertOne({
                        content: textToAdd,
                        createdAt: new Date(),
                    });

                    returnData.push({
                        json: {
                            success: insertResult.acknowledged,
                            insertedId: insertResult.insertedId,
                            message: 'Document added to local database successfully.',
                        },
                        pairedItem: { item: itemIndex },
                    });
                    this.logger.debug(`Document added to local DB with ID: ${insertResult.insertedId}`);

                } catch (error: any) { // Use 'any' for error type
                    this.logger.error(`Failed to add document to MongoDB: ${error.message || error}`);
                    returnData.push({
                        json: {
                            success: false,
                            error: `Failed to add document to database: ${error.message || error}`,
                        },
                        pairedItem: { item: itemIndex },
                    });
                } finally {
                    if (mongoClient) {
                        await mongoClient.close();
                        mongoClient = undefined;
                    }
                }
            }
        }

        return this.prepareOutputData(returnData);
    }
}
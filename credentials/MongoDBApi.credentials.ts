import {
    IAuthenticateGeneric,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class MongoDBApi implements ICredentialType {
    name = 'MongoDBApi';
    displayName = 'MongoDB Connection';
    documentationUrl = 'https://docs.mongodb.com/drivers/node/current/';
    properties: INodeProperties[] = [
        {
            displayName: 'Database URL',
            name: 'databaseUrl',
            type: 'string',
            default: 'mongodb://localhost:27017', // Default for local MongoDB
            placeholder: 'mongodb://localhost:27017',
            description: 'The connection URL for your MongoDB instance. Example: mongodb://localhost:27017',
            required: true,
        },
        {
            displayName: 'Database Name',
            name: 'databaseName',
            type: 'string',
            default: 'plagiarism_db',
            placeholder: 'plagiarism_db',
            description: 'The name of the database to use for plagiarism documents.',
            required: true,
        },
        {
            displayName: 'Collection Name',
            name: 'collectionName',
            type: 'string',
            default: 'documents',
            placeholder: 'documents',
            description: 'The name of the collection to store and check documents.',
            required: true,
        },

        {
            displayName: 'Username',
            name: 'username',
            type: 'string',
            default: '',
            placeholder: 'mongodb_user',
            description: 'Username for MongoDB authentication (optional).',
        },
        {
            displayName: 'Password',
            name: 'password',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            placeholder: 'mongodb_password',
            description: 'Password for MongoDB authentication (optional).',
        },
    ];
    authenticate = {
        type: 'generic',
        properties: {
            // MongoDB connection string typically handles auth
            // We'll construct the connection string in the node
        },
    } as IAuthenticateGeneric;
}
import {
    IAuthenticateGeneric,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class RapidApi implements ICredentialType {
    name = 'RapidApi';
    displayName = 'RapidAPI Key';
    documentationUrl = 'https://rapidapi.com/smodin/api/plagiarism-checker-and-auto-citation-generator-multi-lingual'; // Link to the specific API
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            default: '',
            description: 'Your RapidAPI Key for the plagiarism checker service.',
            required: true,
        },
    ];
    authenticate = {
        type: 'generic',
        properties: {
            headers: {
                'x-rapidapi-key': '={{$credentials.apiKey}}',
                'x-rapidapi-host': 'plagiarism-checker-and-auto-citation-generator-multi-lingual.p.rapidapi.com'
            },
        },
    } as IAuthenticateGeneric;
}
import tslint from 'eslint-config-salesforce-typescript';
import plugin from 'eslint-plugin-sf-plugin';

const configs = [...tslint, ...plugin.configs.recommended];

export default configs;

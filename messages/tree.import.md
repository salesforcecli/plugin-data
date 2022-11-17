# summary

import data into an org

# description

import data into an org
IMPORTANT: Where possible, we changed noninclusive terms to align with our company value of Equality. We maintained certain terms to avoid any effect on customer implementations.

Imports data into an org using the SObject Tree Save API. This data can include master-detail relationships.
To generate JSON files for use with data:import:tree, run "<%= config.bin %> data:export:tree".
The SObject Tree API supports requests that contain up to 200 records. For more information, see the REST API Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm

# flags.files

comma-delimited, ordered paths of json files containing collection of record trees to insert

# flags.plan

path to plan to insert multiple data files that have master-detail relationships

# flags.contenttype

if data file extension is not .json, provide content type (applies to all files)

# flags.confighelp

display schema information for the --plan configuration file to stdout; if you use this option, all other options except --json are ignored

# examples

- <%= config.bin %> <%= command.id %> -f Contact.json,Account.json -u me@my.org

- <%= config.bin %> <%= command.id %> -p Account-Contact-plan.json -u me@my.org

# importFailure

Data plan file %s did not validate against the schema.

# importFailureActions

Did you run the data:export:tree command with the --plan flag?
Make sure you are importing a plan file.
You can get help with the import plan schema by running <%= config.bin %> data:import:tree --confighelp

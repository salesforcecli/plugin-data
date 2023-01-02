# summary

Import data from one or more JSON files into an org.

# description

The JSON files that contain the data are in sObject tree format, which is a collection of nested, parent-child records with a single root record. Use the "<%= config.bin %> data export tree" command to generate these JSON files.

If you used the --plan flag when exporting the data to generate a plan definition file, use the --plan flag to reference the file when you import. If you're not using a plan, use the --files flag to list the files. If you specify multiple JSON files that depend on each other in a parent-child relationship, be sure you list them in the correct order.

The sObject Tree API supports requests that contain up to 200 records. For more information, see the REST API Developer Guide. (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm)

# flags.files

Comma-separated and in-order JSON files that contain the records, in sObject tree format, that you want to insert.

# flags.plan

Plan definition file to insert multiple data files.

# flags.contenttype

Content type of import files if their extention is not .json.

# flags.confighelp

Display schema information for the --plan configuration file to stdout; if you specify this flag, all other flags except --json are ignored.

# examples

- Import the records contained in two JSON files into the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --files Contact.json,Account.json --target-org my-scratch

- Import records using a plan definition file into your default org:

  <%= config.bin %> <%= command.id %> --plan Account-Contact-plan.json

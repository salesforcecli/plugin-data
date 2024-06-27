# summary

Import data from one or more JSON files into an org.

# description

The JSON files that contain the data are in sObject tree format, which is a collection of nested, parent-child records with a single root record. Use the "<%= config.bin %> data export tree" command to generate these JSON files.

If you used the --plan flag when exporting the data to generate a plan definition file, use the --plan flag to reference the file when you import. If you're not using a plan, use the --files flag to list the files. If you specify multiple JSON files that depend on each other in a parent-child relationship, be sure you list them in the correct order.

# flags.files.summary

Comma-separated and in-order JSON files that contain the records, in sObject tree format, that you want to insert.

# flag.files.description

Each file can contain up to 200 total records. For more information, see the REST API Developer Guide. (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm)

# flags.plan.summary

Plan definition file to insert multiple data files.

# flags.plan.description

Unlike when you use the `--files` flag, the files listed in the plan definition file **can** contain more then 200 records. When the CLI executes the import, it automatically batches the records to comply with the 200 record limit set by the API.

The order in which you list the files in the plan definition file matters. Specifically, records with lookups to records in another file should be listed AFTER that file. For example, let's say you're loading Account and Contact records, and the contacts have references to those accounts. Be sure you list the Accounts file before the Contacts file.

The plan definition file has the following schema:

- items(object) - SObject Type: Definition of records to be insert per SObject Type
  - sobject(string) - Name of SObject: Child file references must have SObject roots of this type
  - files(array) - Files: An array of files paths to load

# examples

- Import the records contained in two JSON files into the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --files Contact.json,Account.json --target-org my-scratch

- Import records using a plan definition file into your default org:

  <%= config.bin %> <%= command.id %> --plan Account-Contact-plan.json

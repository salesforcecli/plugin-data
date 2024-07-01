# summary

Import data from one or more JSON files into an org.

# description

The JSON files that contain the data are in sObject tree format, which is a collection of nested, parent-child records with a single root record. Use the "<%= config.bin %> data export tree" command to generate these JSON files.

If you used the --plan flag when exporting the data to generate a plan definition file, use the --plan flag to reference the file when you import. If you're not using a plan, use the --files flag to list the files. If you specify multiple JSON files that depend on each other in a parent-child relationship, be sure you list them in the correct order.

The sObject Tree API supports requests that contain up to 200 records. For more information, see the REST API Developer Guide. (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm)

# flags.files.summary

Comma-separated and in-order JSON files that contain the records, in sObject tree format, that you want to insert.

# flags.plan.summary

Plan definition file to insert multiple data files.

# flags.content-type.summary

Content type of import files if their extention is not .json.

# flags.content-type.deprecation

The `config-type` flag is deprecated and will be moved to a `legacy` command after July 10, 2024. It will be completely removed after Nov 10, 2024. Use the new `data tree beta import` command.

# flags.config-help.summary

Display schema information for the --plan configuration file to stdout; if you specify this flag, all other flags except --json are ignored.

# flags.config-help.deprecation

The `config-help` flag is deprecated and will be moved to a `legacy` command after July 10, 2024. It will be completely removed after Nov 10, 2024. Use the new `data tree beta import` command.

# examples

- Import the records contained in two JSON files into the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --files Contact.json,Account.json --target-org my-scratch

- Import records using a plan definition file into your default org:

  <%= config.bin %> <%= command.id %> --plan Account-Contact-plan.json

# schema-help

schema(array) - Data Import Plan: Schema for SFDX Toolbelt's data import plan JSON.

- items(object) - SObject Type: Definition of records to be insert per SObject Type
  - sobject(string) - Name of SObject: Child file references must have SObject roots of this type
  - saveRefs(boolean) - Save References: Post-save, save references (Name/ID) to be used for reference replacement in subsequent saves. Applies to all data files for this SObject type.
  - resolveRefs(boolean) - Resolve References: Pre-save, replace @<reference> with ID from previous save. Applies to all data files for this SObject type.
  - files(array) - Files: An array of files paths to load
  - items(string|object) - Filepath: Filepath string or object to point to a JSON or XML file having data defined in SObject Tree format.

# deprecation

After Nov 10, 2024, this command will no longer be available. Use `data export tree`.

# summary

Export data from an org into one or more JSON files.

# description

Specify a SOQL query, either directly at the command line or read from a file, to retrieve the data you want to export. The exported data is written to JSON files in sObject tree format, which is a collection of nested, parent-child records with a single root record. Use these JSON files to import data into an org with the "<%= config.bin %> data import tree" command.

If your SOQL query references multiple objects, the command generates a single JSON file by default. You can specify the --plan flag to generate separate JSON files for each object and a plan definition file that aggregates them. You then specify just this plan definition file when you import the data into an org.

The SOQL query can return a maximum of 2,000 records. For more information, see the REST API Developer Guide. (https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm).

# flags.query.summary

SOQL query, or filepath of a file that contains the query, to retrieve records.

# flags.plan.summary

Generate multiple sObject tree files and a plan definition file for aggregated import.

# flags.prefix.summary

Prefix of generated files.

# flags.output-dir.summary

Directory in which to generate the JSON files; default is current directory.

# examples

- Export records retrieved with the specified SOQL query into a single JSON file in the current directory; the command uses your default org:

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, (SELECT Name, Address__c FROM Properties__r) FROM Broker__c"

- Export data using a SOQL query in the "query.txt" file and generate JSON files for each object and a plan that aggregates them:

  <%= config.bin %> <%= command.id %> --query query.txt --plan

- Prepend "export-demo" before each generated file and generate the files in the "export-out" directory; run the command on the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --query query.txt --plan --prefix export-demo --output-dir export-out --target-org my-scratch

# PrefixSlashError

`--prefix` cannot contain a forward slash or backslash.

# PlanJsonWarning

Starting on Nov 10, 2024, the JSON output for `--plan` will no longer include the `saveRefs` and `resolveRefs` properties.

# LegacyDeprecation

Starting on Nov 10, 2024, this command will no longer be available. Use `data export tree` instead.

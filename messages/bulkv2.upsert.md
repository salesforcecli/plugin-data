# summary

Bulk upsert records to an org from a CSV file. Uses Bulk API 2.0.

# description

An upsert refers to inserting a record into a Salesforce object if the record doesn't already exist, or updating it if it does exist.

When you execute this command, it starts a job, displays the ID, and then immediately returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command outputs the IDs. Use the job and batch IDs to check the status of the job with the "<%= config.bin %> data upsert resume" command.

See "Prepare CSV Files" in the Bulk API Developer Guide for details on formatting your CSV file. (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_prepare_csv.htm)

# examples

- Bulk upsert records to the Contact object in your default org:

  <%= config.bin %> <%= command.id %> --sobject Contact --file files/contacts.csv --external-id Id

- Bulk upsert records to a custom object in an org with alias my-scratch and wait 5 minutes for the command to complete:

  <%= config.bin %> <%= command.id %> --sobject MyObject__c --file files/file.csv --external-id MyField__c --wait 5 --target-org my-scratch

# flags.external-id.summary

Name of the external ID field, or the Id field.

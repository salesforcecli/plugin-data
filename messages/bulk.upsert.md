# summary

Bulk upsert records to an org from a CSV file. Uses Bulk API 1.0.

# description

An upsert refers to inserting a record into a Salesforce object if the record doesn't already exist, or updating it if it does exist.

When you execute this command, it starts a job and one or more batches, displays their IDs, and then immediately returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command outputs the IDs. Use the job and batch IDs to check the status of the job with the "<%= config.bin %> force data bulk status" command. A single job can contain many batches, depending on the length of the CSV file.

See "Prepare CSV Files" in the Bulk API Developer Guide for details on formatting your CSV file. (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm)

By default, the job runs the batches in parallel, which we recommend. You can run jobs serially by specifying the --serial flag. But don't process data in serial mode unless you know this would otherwise result in lock timeouts and you can't reorganize your batches to avoid the locks.

# examples

- Bulk upsert records to the Contact object in your default org:

  <%= config.bin %> --sobject Contact --file files/contacts.csv --external-id Id

- Bulk upsert records to a custom object in an org with alias my-scratch and wait 5 minutes for the command to complete:

  <%= config.bin %> <%= command.id %> --sobject MyObject__c --file files/file.csv --external-id MyField__c --wait 5 --target-org my-scratch

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, that you want to upsert records to.

# flags.file.summary

CSV file that contains the records to upsert.

# flags.external-id.summary

Name of the external ID field, or the Id field.

# flags.wait.summary

Number of minutes to wait for the command to complete before displaying the results.

# flags.serial.summary

Run batches in serial mode.

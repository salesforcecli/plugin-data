# summary

Bulk upsert records to an org from a CSV file.

# description

An upsert refers to inserting a record into a Salesforce object if the record doesn't already exist, or updating it if it does exist.

When you execute this command, it starts a job and one or more batches, displays their IDs, and then immediately returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command outputs the IDs. Use the job and batch IDs to check the status of the job with the "<%= config.bin %> data resume" command. A single job can contain many batches, depending on the length of the CSV file.

See "Prepare CSV Files" in the Bulk API Developer Guide for details on formatting your CSV file. (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_preparing.htm)

By default, the job runs the batches in parallel. Specify --serial to run them serially.

# examples

- Bulk upsert records to the Contact object:

  <%= config.bin %> --sobject Contact --file files/contacts.csv --external-id Id

- Bulk upsert records to a custom object and wait 5 minutes for the command to complete:

  <%= config.bin %> <%= command.id %> --sobject MyObject**c --file files/file.csv --external-id MyField**c --wait 5

# flags.sobjecttype

Salesforce object, either standard or custom, that you want to upsert records to.

# flags.csvfile

CSV file that contains the records to upsert.

# flags.externalid

Field name of the external ID.

# flags.wait

Number of minutes to wait for the command to complete before displaying the results.

# flags.serial

Run batches in serial mode.

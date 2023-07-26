# summary

Retrieve and display a single record of a Salesforce or Tooling API object.

# description

Specify the record you want to retrieve with either its ID or with a list of field-value pairs that identify the record. If your list of fields identifies more than one record, the command fails; the error displays how many records were found.

When specifying field-value pairs, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of double quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

The command displays all the record's fields and their values, one field per terminal line. Fields with no values are displayed as "null".

This command retrieves a record from Salesforce objects by default. Use the --use-tooling-api flag to retrieve from a Tooling API object.

# flags.sobject.summary

API name of the Salesforce or Tooling API object that you're retrieving a record from.

# flags.record-id.summary

ID of the record you’re retrieving.

# flags.where.summary

List of <fieldName>=<value> pairs that identify the record you want to display.

# flags.use-tooling-api.summary

Use Tooling API so you can retrieve a record from a Tooling API object.

# examples

- Retrieve and display a record from Account with the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> --sobject Account --record-id 00180XX

- Retrieve a record from Account whose name equals "Acme":

  <%= config.bin %> <%= command.id %> --sobject Account --where "Name=Acme"

- Retrieve a record from Account identified with two field values, one that contains a space; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --sobject Account --where "Name='Universal Containers' Phone='(123) 456-7890'" --target-org myscratch

- Retrieve a record from the Tooling API object TraceFlag with the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> --use-tooling-api --sobject TraceFlag --record-id 7tf8c

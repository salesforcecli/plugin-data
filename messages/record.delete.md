# summary

Deletes a single record from a Salesforce or Tooling API object.

# description

Specify the record you want to delete with either its ID or with a list of field-value pairs that identify the record. If your list of fields identifies more than one record, the delete fails; the error displays how many records were found.

When specifying field-value pairs, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of double quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

This command deletes a record from Salesforce objects by default. Use the --use-tooling-api flag to delete from a Tooling API object.

# flags.sobject.summary

API name of the Salesforce or Tooling API object that you're deleting a record from.

# flags.record-id.summary

ID of the record you’re deleting.

# flags.where.summary

List of <fieldName>=<value> pairs that identify the record you want to delete.

# flags.use-tooling-api.summary

Use Tooling API so you can delete a record from a Tooling API object.

# examples

- Delete a record from Account with the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> --sobject Account --record-id 00180XX

- Delete a record from Account whose name equals "Acme":

  <%= config.bin %> <%= command.id %> --sobject Account --where "Name=Acme"

- Delete a record from Account identified with two field values, one that contains a space; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --sobject Account --where "Name='Universal Containers' Phone='(123) 456-7890'" --target-org myscratch

- Delete a record from the Tooling API object TraceFlag with the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> --use-tooling-api --sobject TraceFlag --record-id 7tf8c

# deleteSuccess

Successfully deleted record: %s.

# deleteFailure

Failed to delete record. %s

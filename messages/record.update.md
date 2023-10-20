# summary

Updates a single record of a Salesforce or Tooling API object.

# description

Specify the record you want to update with either its ID or with a list of field-value pairs that identify the record. If your list of fields identifies more than one record, the update fails; the error displays how many records were found.

When using field-value pairs for both identifying the record and specifiyng the new field values, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of double quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

This command updates a record in Salesforce objects by default. Use the --use-tooling-api flag to update a Tooling API object.

# flags.sobject.summary

API name of the Salesforce or Tooling API object that contains the record you're updating.

# flags.record-id.summary

ID of the record you’re updating.

# flags.where.summary

List of <fieldName>=<value> pairs that identify the record you want to update.

# flags.use-tooling-api.summary

Use Tooling API so you can update a record in a Tooling API object.

# flags.values.summary

Fields that you're updating, in the format of <fieldName>=<value> pairs.

# examples

- Update the Name field of an Account record with the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> --sobject Account --record-id 001D0 --values "Name=NewAcme"

- Update the Name field of an Account record whose current name is 'Old Acme':

  <%= config.bin %> <%= command.id %> --sobject Account --where "Name='Old Acme'" --values "Name='New Acme'"

- Update the Name and Website fields of an Account record with the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> --sobject Account --record-id 001D0 --values "Name='Acme III' Website=www.example.com"

- Update the ExpirationDate field of a record of the Tooling API object TraceFlag using the specified (truncated) ID:

  <%= config.bin %> <%= command.id %> -t --sobject TraceFlag --record-id 7tf170000009cUBAAY --values "ExpirationDate=2017-12-01T00:58:04.000+0000"

# updateSuccess

Successfully updated record: %s.

# updateFailure

Failed to update record. %s

# updateFailureWithFields

Failed to update record with code %s. Message: %s. Fields: %s.

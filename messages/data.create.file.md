# summary

Upload a local file to an org.

# description

This command always creates a new file in the org; you can't update an existing file. After a successful upload, the command displays the ID of the new ContentDocument record which represents the uploaded file.

By default, the uploaded file isn't attached to a record; in the Salesforce UI the file shows up in the Files tab. You can optionally attach the file to an existing record, such as an account, as long as you know its record ID.

You can also give the file a new name after it's been uploaded; by default its name in the org is the same as the local file name.

# flags.title.summary

New title given to the file (ContentDocument) after it's uploaded.

# examples

- Upload the local file "resources/astro.png" to your default org:

  <%= config.bin %> <%= command.id %> --file resources/astro.png

- Give the file a different filename after it's uploaded to the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --file resources/astro.png --title AstroOnABoat.png --target-org my-scratch

- Attach the file to a record in the org:

  <%= config.bin %> <%= command.id %> --file path/to/astro.png --parent-id a03fakeLoJWPIA3

# flags.file.summary

Path of file to upload.

# flags.parent-id.summary

ID of the record to attach the file to.

# createSuccess

Created file with ContentDocumentId %s.

# attachSuccess

File attached to record with ID %s.

# attachFailure

The file was successfully uploaded, but we weren't able to attach it to the record.

# insufficientAccessActions

- Check that the record ID is correct and that you have access to it.

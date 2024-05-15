# summary

Upload a local file to an org

# description

Optionally, attach the file to an existing record and give it a new name.

# flags.name.summary

Name given to the created file.

# examples

- upload a local file to the default org
  <%= config.bin %> <%= command.id %> --file path/to/astro.png

- give the file a different filename in the org  
  <%= config.bin %> <%= command.id %> --file path/to/astro.png --name AstroOnABoat.png

- attach the file to a record in the org
  <%= config.bin %> <%= command.id %> --file path/to/astro.png --parentid a03O900000LoJWPIA3

# flags.file.summary

Path of file to upload.

# flags.parent-id.summary

Id of the record to attach the file to.

# createSuccess

Created file with ContentDocumentId %s.

# attachSuccess

File attached to record with ID %s.

# attachFailure

The file was uploaded but not able to attach to the record.

# insufficientAccessActions

- Check that the record ID is correct and that you have access to it.

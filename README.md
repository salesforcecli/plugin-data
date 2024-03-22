[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-data.svg?label=@salesforce/plugin-data)](https://www.npmjs.com/package/@salesforce/plugin-data) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-data.svg)](https://npmjs.org/package/@salesforce/plugin-data) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-data/main/LICENSE.txt)

# plugin-data

`data` commands for Salesforce CLI.

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information
on the CLI, read
the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
.

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific
version or tag if needed.

## Install

```bash
sf plugins:install data@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of what you are trying to add/fix. That
   way, we can also offer suggestions or let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing
   using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request
   will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License Agreement. You can do so by going
to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-data

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev force:data
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be
useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins:link .
# To verify
sf plugins
```

# Commands

<!-- commands -->

# Command Topics

- [`sf data`](docs/data.md) - Manage records in your org.
- [`sf force`](docs/force.md) - Legacy commands for backward compatibility.

<!-- commandsstop -->

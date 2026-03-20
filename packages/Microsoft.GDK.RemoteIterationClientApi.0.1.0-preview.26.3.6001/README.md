# Microsoft.GDK.RemoteIterationClient

Remote Windows Development API for Xbox PC Gaming Device Tools.

## Overview

This package provides the client API for remote iteration with Xbox gaming devices, enabling developers to streamline their development workflow.

## Installation

Install via NuGet Package Manager:

```
Install-Package Microsoft.GDK.RemoteIterationClientApi
```

Or via .NET CLI:

```
dotnet add package Microsoft.GDK.RemoteIterationClientApi
```

## Contents

This package includes:

- **Headers**: `WdRemoteIteration.h` - C/C++ header file for the API
- **Binaries**: DLLs for x64 and ARM64 platforms
- **WinMD**: Windows Metadata for language projections

## Supported Platforms

- Windows x64
- Windows ARM64

## Usage

Include the header in your project:

```cpp
#include <WdRemoteIteration.h>
```

The NuGet package automatically configures include paths and library references when installed.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Versioning
The RIT API follows semantic versioning 2.0 (MAJOR.MINOR.PATCH):

- PATCH updates are safe drops in fixes and do not change API contracts or behavior and updating will not require code changes or impact dependencies.
- MINOR updates may introduce new APIs or evolve existing ones in a backward-compatible way; deprecated functionality may be marked but will continue to work, giving you time to migrate. Dependency updates should be reviewed but are expected to remain compatible.
- MAJOR updates indicate intentional breaking changes that may require code or dependency updates; these releases clearly document required migration steps.

You can safely auto-update within the same MAJOR version, while treating MAJOR version changes as opt-in upgrades that should be planned and validated.

## Support

For issues and questions, please refer to the official Microsoft documentation.


@{
    RootModule        = 'RitApi.psm1'
    ModuleVersion     = '0.1.0'
    GUID              = 'a3f7c2d1-4e8b-4f9a-bc3d-5e6f7a8b9c0d'
    Author            = 'stevenjpr'
    Description       = 'PowerShell module for the Remote Iteration API (wdremoteapi.dll). Provides cmdlets to copy files, launch, resume, and terminate games on remote Windows devices.'
    PowerShellVersion = '7.2'
    FunctionsToExport = @('Copy-RitFiles', 'Start-RitGame', 'Stop-RitGame', 'Resume-RitGame', 'Register-RitGame')
    CmdletsToExport   = @()
    VariablesToExport = @()
    AliasesToExport   = @()
    PrivateData       = @{
        PSData = @{
            Tags = @('Xbox', 'GDK', 'RemoteIteration', 'GameDev')
        }
    }
}

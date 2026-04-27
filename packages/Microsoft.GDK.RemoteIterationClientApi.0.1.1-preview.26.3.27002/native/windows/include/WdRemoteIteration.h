// Copyright (c) Microsoft Corporation. All rights reserved.
#pragma once

#include <cstdio>
#include <cstdint>
#include <sal.h>
#include <Winerror.h>

#if defined(_WIN32) && defined(WD_REMOTE_ITERATION_EXPORT)
#define WD_REMOTE_ITERATION_API __declspec(dllexport)
#elif defined(_WIN32) && defined(WD_REMOTE_ITERATION_IMPORT)
#define WD_REMOTE_ITERATION_API __declspec(dllimport)
#else
#define WD_REMOTE_ITERATION_API
#endif

extern "C"
{
    //---------------------------------------------------------------------------------------------
    // WdCopyFileProgressInfo
    //---------------------------------------------------------------------------------------------
    // WdCopyFileProgressInfo fields:
    //  - relativeFilePath: The file path being copied, relative to the root of the destination
    //    path (UTF-8).
    //  - sourcePath: The source path of the directory being copied (UTF-8).
    //  - destinationPath: The full destination path of the directory being copied (UTF-8).
    //  - bytesTransferred: The number of bytes transferred so far for this file.
    //  - fileSize: The total size of the file in bytes.
    struct WdCopyFileProgressInfo
    {
        const char* relativeFilePath;
        const char* sourcePath;
        const char* destinationPath;
        uint64_t bytesTransferred;
        uint64_t fileSize;
    };

    //---------------------------------------------------------------------------------------------
    // WdCopyOperationSummary
    //---------------------------------------------------------------------------------------------
    // WdCopyOperationSummary fields:
    //  - filesCompletedCount: The number of files that have completed copying.
    //  - bytesTransferredCount: The total number of bytes transferred so far in the entire copy
    //    operation.
    //  - totalFileCount: The total number of files to copy in the entire copy operation.
    //  - totalByteCount: The total number of bytes to copy in the entire copy operation.
    struct WdCopyOperationSummary
    {
        uint64_t filesCompletedCount;
        uint64_t bytesTransferredCount;
        uint64_t totalFileCount;
        uint64_t totalByteCount;
    };

    // --------------------------------------------------------------------------------------------
    // WdCopyFilesStatusCallback
    // --------------------------------------------------------------------------------------------
    // WdCopyFilesStatusCallback parameters:
    //  - fileProgressCount: The number of files that have progress updates since the last callback
    //    invocation.
    //  - fileUpdates: An array of WdCopyFileProgressInfo structures, one for each file with
    //    progress updates.
    //  - copyUpdates: A summary of the overall copy operation progress.
    //  - context: The user-defined context pointer provided in WdCopyStatusCallbacks.
    //  Returning a failed HRESULT from this callback will abort the copy operation and return that
    //  error from WdRemoteCopy.
    typedef HRESULT (*WdCopyFilesStatusCallback)(
        _In_ size_t fileProgressCount,
        _In_reads_opt_(fileProgressCount) const WdCopyFileProgressInfo* fileUpdates,
        _In_ const WdCopyOperationSummary* copyUpdates,
        _In_opt_ void* context);

    // --------------------------------------------------------------------------------------------
    // WdCopyDirection
    // --------------------------------------------------------------------------------------------
    // WdCopyDirection fields:
    //   - CopyTo: Copy files to the remote device. Default value.
    //   - CopyFrom: Copy files from the remote device.
    enum class WdCopyDirection : uint32_t
    {
        CopyTo = 0,
        CopyFrom = 1
    };

    // -------------------------------------------------------------------------------------------
    // WdCopyOptions
    // --------------------------------------------------------------------------------------------
    // WdCopyOptions fields:
    //   - copyDirection: The direction of the copy operation to or from a remote
    //     device.
    //     WdCopyDirection::CopyTo is the default value if not specified.
    //   - commonRootAlias: An optional alias for a common root alias on the remote device (UTF-8).
    //---------------------------------------------------------------------------------------------
    // CommonRoots
    //---------------------------------------------------------------------------------------------
    // Common Roots allow users to use pre-configure known locations where games are copied to or
    // launched from, and refer to them by alias instead of full path.
    //
    // If destinationPath is an absolute path, commonRootAlias will be ignored.
    //
    // Example: if [path] was the default common root setting remotePath to "MyGame" using default
    // common root would copy to [path]\MyGame on the remote device.
    // Example: setting remotepath to "D:\Games\MyGame", commonRootAlias is ignored.
    // Game will be copy to "D:\Games\MyGame" on the remote device regardless of commonRootAlias
    // value.
    struct WdCopyOptions
    {
        WdCopyDirection copyDirection;
        const char* commonRootAlias;
    };

    // --------------------------------------------------------------------------------------------
    // WdCopyErrorSeverity
    // --------------------------------------------------------------------------------------------
    // WdCopyErrorSeverity fields:
    //   - Warning: Warning message that indicates a potential issue but does not prevent the copy
    //     operation from proceeding.
    //   - Error: Error message that indicates a failure in the copy operation. Provides extra
    //     information from the returned HRESULT of WdCopyRemote.
    enum class WdCopyErrorSeverity : uint32_t
    {
        Warning = 0,
        Error = 1
    };

    // --------------------------------------------------------------------------------------------
    // WdCopyErrorCallback
    // --------------------------------------------------------------------------------------------
    // WdCopyErrorCallback parameters:
    //  - severity: The severity of the message (Warning, Error).
    //  - message: The message string.
    //  - error: The HRESULT error code associated with the message. S_OK if warning.
    //  - context: The context pointer provided in WdCopyStatusCallbacks.
    typedef HRESULT (*WdCopyErrorCallback)(
        _In_ WdCopyErrorSeverity severity, _In_z_ const char* message, _In_ HRESULT error, _In_opt_ void* context);

    // -------------------------------------------------------------------------------------------
    // WdCopyStatusCallbacks
    // --------------------------------------------------------------------------------------------
    // WdCopyStatusCallbacks fields:
    //  - copyFilesStatusCallback: An optional callback function that receives status updates for
    //    files being copied. Ideal for implementing copy progress reporting in a user interface.
    //  - refreshRateMs: The desired frequency in milliseconds for receiving status updates in the
    //    copyFilesStatusCallback. If set to 0, the default refresh rate is 500ms.
    //  - copyErrorCallback: An optional callback function that receives diagnostic messages from
    //    the copy operation, such as errors or warnings.
    //  - context: A user-defined context pointer that is passed to the callback
    struct WdCopyStatusCallbacks
    {
        WdCopyFilesStatusCallback copyFilesStatusCallback;
        uint32_t refreshRateMs;
        WdCopyErrorCallback copyErrorCallback;
        void* context;
    };

    // --------------------------------------------------------------------------------------------
    // WdCopySearchOptions
    // --------------------------------------------------------------------------------------------
    // WdCopySearchOptions fields:
    //  - includeFilePattern: includes files that match the exact specified names. Wildcard
    //    characters * and ? are supported. Default is everything is included.
    //    List of pattern can be separated by semicolon (;).
    //    Files with spaces in the name must be quoted.
    //
    //  - excludeFilePattern: excludes files that match the exact specified names. Wildcard
    //    characters * and ? are supported. Default is empty (no excluded files).
    //    List of pattern can be separated by semicolon (;).
    //    Files with spaces in the name must be quoted.
    //
    //  - excludeDirPattern: Excludes directories that match the specified names and paths.
    //    Wildcard characters * and ? are supported. Default is empty, no excluded directories
    //    from being copied.
    //
    //  - includeFileAttributes: Include files for which any of the specified file attributes are set.
    //    Supported include valid options are FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_ARCHIVE,
    //    FILE_ATTRIBUTE_SYSTEM, and FILE_ATTRIBUTE_HIDDEN. Default is 0 (All attributes are included).
    //
    //  - excludeFileAttributes: Exclude files for which any of the specified file attributes are set.
    //    Supported exclude valid options are FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_ARCHIVE,
    //    FILE_ATTRIBUTE_SYSTEM, and FILE_ATTRIBUTE_HIDDEN. Default is 0 (no attributes excluded).
    //
    // Example: Copy files that with extentions .exe and .dll
    // WdCopySearchOptions searchOptions = {
    //     .includefilePattern = "*.exe;*.dll",
    //     .excludeFilePattern = nullptr,
    //     .excludeDirPattern = nullptr,
    //     .includeFileAttributes = 0,
    //     .excludeFileAttributes = 0
    // };
    //
    //
    // Example: Exclude directories named temp from the copy
    // WdCopySearchOptions searchOptions = {
    //     .includefilePattern = nullptr,
    //     .excludeFilePattern = nullptr,
    //     .excludeDirPattern = "temp",
    //     .includeFileAttributes = 0,
    //     .excludeFileAttributes = 0
    // };
    //
    // Example: Exclude directories that ends with temp from the copy
    // WdCopySearchOptions searchOptions = {
    //     .includefilePattern = nullptr,
    //     .excludeFilePattern = nullptr,
    //     .excludeDirPattern = "*temp",
    //     .includeFileAttributes = 0,
    //     .excludeFileAttributes = 0
    // };
    //
    // Example: Only Copy file with "game.exe" in the name
    // WdCopySearchOptions searchOptions = {
    //     .includefilePattern = "game.exe",
    //     .excludeFilePattern = nullptr,
    //     .excludeDirPattern = nullptr,
    //     .includeFileAttributes = 0,
    //     .excludeFileAttributes = 0
    // };
    //
    // Example: When there is a conflict between include and exclude pattern, exclude pattern takes
    // precedence and file will not be copied
    // WdCopySearchOptions searchOptions = {
    //     .includefilePattern = "game.exe",
    //     .excludeFilePattern = "game.exe",
    //     .excludeDirPattern = nullptr,
    //     .includeFileAttributes = 0,
    //     .excludeFileAttributes = 0
    // };
    //
    // Example: Only copy files that are read-only or system, and exclude hidden files
    // WdCopySearchOptions searchOptions = {
    //     .includefilePattern = nullptr,
    //     .excludeFilePattern = nullptr,
    //     .excludeDirPattern = nullptr,
    //     .includeFileAttributes = FILE_ATTRIBUTE_READONLY | FILE_ATTRIBUTE_SYSTEM,
    //     .excludeFileAttributes = FILE_ATTRIBUTE_HIDDEN
    // };
    struct WdCopySearchOptions
    {
        _In_z_ const char* includeFilePattern;
        _In_z_ const char* excludeFilePattern;
        _In_z_ const char* excludeDirPattern;
        uint64_t includeFileAttributes;
        uint64_t excludeFileAttributes;
    };

    // Handle for cancelling a WdRemoteCopy operation. Created by WdCreateCancellationHandle and
    // freed by WdCloseCancellationHandle.
    typedef struct WdCancellationHandleImpl* WdCancellationHandle;

    //---------------------------------------------------------------------------------------------
    // WdCreateCancellationHandle API
    //---------------------------------------------------------------------------------------------
    // Creates a cancellation handle that can be used to cancel copy operation by WdRemoteCopy.
    // WdCreateCancellationHandle parameters:
    //  - cancellationHandle: Contains a handle to the cancellationHandle.
    //    The caller is responsible for freeing the handle using WdCloseCancellationHandle.
    WD_REMOTE_ITERATION_API HRESULT WdCreateCancellationHandle(_Out_ WdCancellationHandle* cancellationHandle);

    //---------------------------------------------------------------------------------------------
    // WdCloseCancellationHandle API
    //---------------------------------------------------------------------------------------------
    // Closes a cancellation handle created by WdCreateCancellationHandle .
    // WdCloseCancellationHandle parameters:
    //  - cancellationHandle: The cancellation handle to close. After this call, the handle is
    //    no longer valid.
    WD_REMOTE_ITERATION_API void WdCloseCancellationHandle(_In_ WdCancellationHandle cancellationHandle);

    //---------------------------------------------------------------------------------------------
    // WdDuplicateCancellationHandle API
    //---------------------------------------------------------------------------------------------
    // Duplicates a WdCancellationHandle handle.
    // WdDuplicateCancellationHandle parameters:
    //  - cancellationHandle: The cancellation handle to duplicate.
    //  - duplicatedHandle: Contains the duplicate cancellation handle.
    WD_REMOTE_ITERATION_API HRESULT WdDuplicateCancellationHandle(
        _In_ WdCancellationHandle cancellationHandle, _Out_ WdCancellationHandle* duplicatedHandle);

    //---------------------------------------------------------------------------------------------
    // WdRemoteCopy API
    //---------------------------------------------------------------------------------------------
    // WdRemoteCopy parameters:
    //  - remoteDevice: The address or name of the remote device (UTF-8).
    //  - sourcePath: The source path to copy from (UTF-8).
    //  - destinationPath: The destination path to copy to (UTF-8).
    //  - copyOptions: Optional configuration for the copy operation, such as copy direction and
    //    enumeration mode.
    //    If not specified, the copy direction defaults to WdCopyDirection::CopyTo and the enumeration defaults
    //    to WdEnumerationMode::DeltaCopy, and default common root uses default common root location if
    //    sourcePath is a relative path otherwise commonRootAlias is ignored.
    //  - searchOptions: Optional configuration for which files to include in the copy operation,
    //    such as include/exclude patterns and file attributes. If not specified, all files are
    //    included by default.
    //  - statusCallbacks: Optional callbacks for receiving copy progress and diagnostic messages.
    //  - cancellationHandle: Optional cancellation handle created by WdCreateCancellationHandle
    //    that can be used to cancel the copy operation using WdCancelRemoteCopy.
    //    WdRemoteCopy is a blocking function that does not return until the copy operation is complete
    //    or cancelled.
    WD_REMOTE_ITERATION_API HRESULT WdRemoteCopy(
        _In_z_ const char* remoteDevice,
        _In_z_ const char* sourcePath,
        _In_z_ const char* destinationPath,
        _In_opt_ const WdCopyOptions* copyOptions,
        _In_opt_ const WdCopySearchOptions* searchOptions,
        _In_opt_ const WdCopyStatusCallbacks* statusCallbacks,
        _In_opt_ WdCancellationHandle cancellationHandle);

    //---------------------------------------------------------------------------------------------
    // WdCancelRemoteCopy API
    //---------------------------------------------------------------------------------------------
    // WdCancelRemoteCopy parameters:
    //  - cancellationHandle: The cancellation handle created by WdCreateCancellationHandle.
    //    WdCancelRemoteCopy will cancel the copy and return a S_OK HRESULT from WdRemoteCopy.
    //    WdCancelRemoteCopy is a non-blocking function.
    WD_REMOTE_ITERATION_API HRESULT WdCancelRemoteCopy(_In_ WdCancellationHandle cancellationHandle);

    // --------------------------------------------------------------------------------------------
    // WdLaunchMode
    // --------------------------------------------------------------------------------------------
    // WdLaunchMode fields:
    //  - Immediate: Launch the game immediately.
    //  - Suspended: Launch the game in a suspended state.
    // WdLaunchMode::Immediate is the default mode.
    enum class WdLaunchMode : uint32_t
    {
        Immediate = 0,
        Suspended = 1
    };

    // --------------------------------------------------------------------------------------------
    // WdLaunchOptions
    // --------------------------------------------------------------------------------------------
    // WdLaunchOptions fields:
    //  - launchMode: The mode to launch the game (immediately or suspended).
    //  - commonRootAlias: An optional alias for a common root directory on the remote device (UTF-8).
    //
    // If remotePath from WdLaunchRemoteGame is an absolute path, commonRootAlias will be ignored.
    // Default common root uses default common root location if remotePath is a relative path
    // otherwise commonRootAlias is ignored.
    // If not specified the launch mode defaults to WdLaunchMode::Immediate,
    struct WdLaunchOptions
    {
        WdLaunchMode launchMode;
        const char* commonRootAlias;
    };

    // --------------------------------------------------------------------------------------------
    // WdLaunchRemoteGame API
    // --------------------------------------------------------------------------------------------
    // WdLaunchRemoteGame parameters:
    //  - remoteDevice: The address or name of the remote device to launch the game on (UTF-8).
    //  - remotePath: The path on the remote device to the game executable (UTF-8)
    //    Absolute path or relative path based on whether commonRootAlias in WdLaunchOptions is specified.
    //    If remotePath is an absolute path, commonRootAlias in WdLaunchOptions will be ignored.
    //  - args: Optional command line arguments to launch the game with (UTF-8).
    //  - launchOptions: Optional configuration for launching the game, such as launch mode and
    //    common root alias.
    //    If not specified, the launch mode defaults to WdLaunchMode::Immediate, and default common root
    //    uses default common root location if remotePath is a relative path otherwise
    //    commonRootAlias is ignored.
    //  - processId:  process ID of the launched game.
    //  - threadId:  thread ID of the launched game.
    WD_REMOTE_ITERATION_API HRESULT WdLaunchRemoteGame(
        _In_z_ const char* remoteDevice,
        _In_z_ const char* remotePath,
        _In_opt_z_ const char* args,
        _In_opt_ const WdLaunchOptions* launchOptions,
        _Out_opt_ uint32_t* processId,
        _Out_opt_ uint32_t* threadId);

    // --------------------------------------------------------------------------------------------
    // WdResumeRemoteGame API
    // --------------------------------------------------------------------------------------------
    // Resume the last game launch suspended with WdLaunchRemoteGame.
    // WdResumeRemoteGame parameters:
    //  - remoteDevice: The address or name of the remote device to resume the game on (UTF-8).
    WD_REMOTE_ITERATION_API HRESULT WdResumeRemoteGame(_In_z_ const char* remoteDevice);

    // --------------------------------------------------------------------------------------------
    // WdTerminateRemoteGame API
    // --------------------------------------------------------------------------------------------
    // Terminate the last game launch using WdLaunchRemoteGame.
    // WdTerminateRemoteGame parameters:
    //  - remoteDevice: The address or name of the remote device (UTF-8).
    WD_REMOTE_ITERATION_API HRESULT WdTerminateRemoteGame(_In_z_ const char* remoteDevice);

    // -------------------------------------------------------------------------------------------
    // WdRegisterRemoteXboxGame API
    // --------------------------------------------------------------------------------------------
    // Register Xbox game
    // WdRegisterRemoteXboxGame parameters:
    //  - remoteDevice: The address or name of the remote device (UTF-8).
    //  - remoteFolderPath: The path on the remote device to the folder containing the game to
    //    register (UTF-8).
    //    If remoteFolderPath is an absolute path, commonRootAlias will be ignored.
    //  - commonRootAlias: An optional alias for a common root directory on the remote if null it
    //    uses default common root location (UTF-8).
    WD_REMOTE_ITERATION_API HRESULT WdRegisterRemoteXboxGame(
        _In_z_ const char* remoteDevice, _In_z_ const char* remoteFolderPath, _In_opt_z_ const char* commonRootAlias);
}

EXEC(N'
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N''dbo.Rooms'', N''U'') IS NULL
        THROW 50001, ''Rooms table not found. Select the existing application database.'', 1;
    IF OBJECT_ID(N''dbo.__EFMigrationsHistory'', N''U'') IS NULL
        THROW 50002, ''Migration history not found. Apply the initial migrations first.'', 1;

    IF COL_LENGTH(N''dbo.Rooms'', N''Permissions'') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [Permissions] nvarchar(max) NOT NULL DEFAULT N''{}'';

    IF NOT EXISTS (
        SELECT 1 FROM [dbo].[__EFMigrationsHistory]
        WHERE [MigrationId] = N''20261029031707_RoomPermissions''
    )
        INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion])
        VALUES (N''20261029031707_RoomPermissions'', N''10.0.10'');

    COMMIT TRANSACTION;

    SELECT DB_NAME() AS [DatabaseName],
        COL_LENGTH(N''dbo.Rooms'', N''Permissions'') AS [PermissionsColumnLength],
        [MigrationId]
    FROM [dbo].[__EFMigrationsHistory]
    WHERE [MigrationId] = N''20261029031707_RoomPermissions'';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
');

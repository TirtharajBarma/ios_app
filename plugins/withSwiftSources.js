const fs = require('fs');
const path = require('path');
const { withXcodeProject } = require('@expo/config-plugins');

function swiftFileNames(sourceDir) {
  if (!fs.existsSync(sourceDir)) return [];
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.swift'))
    .map((entry) => entry.name)
    .sort();
}

/** Xcode quotes paths in `.pbxproj`, so match both forms. */
function hasSourceFile(project, pbxPath) {
  const references = project.pbxFileReferenceSection();
  for (const key of Object.keys(references)) {
    if (key.endsWith('_comment')) continue;
    const reference = references[key];
    if (reference && (reference.path === pbxPath || reference.path === `"${pbxPath}"`)) {
      return true;
    }
  }
  return false;
}

/**
 * Adds every `.swift` file in `sourceDir` (relative to the project root) to the
 * first Xcode target, idempotently.
 *
 * Adding a file is not enough: in this xcode version `addFile` creates the
 * PBXFileReference and the group membership but neither a uuid nor a
 * PBXBuildFile, so the build-file entry and the Sources-phase entry have to be
 * added by hand. Without the Sources-phase entry the file is never compiled and
 * the build fails with "cannot find X in scope" as soon as anything references
 * it.
 */
function withSwiftSources(config, { sourceDir, groupName, pluginName }) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const absoluteDir = path.join(modConfig.modRequest.projectRoot, sourceDir);
    const fileNames = swiftFileNames(absoluteDir);

    if (fileNames.length === 0) {
      throw new Error(
        `${pluginName}: no .swift files found in ${absoluteDir}.`
      );
    }

    const target = project.getFirstTarget();
    if (!target) {
      throw new Error(`${pluginName}: could not find the first Xcode target.`);
    }

    /** The Xcode project lives in `ios/`, so the group is one level up. */
    const groupPath = `../${sourceDir}`;

    let groupKey = project.findPBXGroupKey({ name: groupName });
    if (!groupKey) {
      groupKey = project.addPbxGroup([], groupName, groupPath).uuid;
      project.addToPbxGroup(
        { fileRef: groupKey, basename: groupName },
        project.getFirstProject().firstProject.mainGroup
      );
    }

    for (const fileName of fileNames) {
      const pbxPath = `${groupPath}/${fileName}`;
      if (hasSourceFile(project, pbxPath)) continue;

      const file = project.addFile(pbxPath, groupKey, { target: target.uuid });
      if (!file) continue;

      file.uuid = project.generateUuid();
      file.target = target.uuid;
      project.addToPbxBuildFileSection(file);
      project.addToPbxSourcesBuildPhase(file);
    }

    return modConfig;
  });
}

module.exports = { withSwiftSources };

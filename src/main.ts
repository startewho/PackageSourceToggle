import { log, SEP } from "./deps.ts";

// @deno-types="https://unpkg.com/cac/mod.d.ts"
import { cac } from "https://unpkg.com/cac/mod.js";

interface Option {
  SourceDir: string;
  PackageDir: string;
}

interface Project {
  name: string;
  loaction: string;
  refProjects: Project[];
}

const regex = /<PackageReference\s*Include=\"(\S+)\"[^>]*>/gm; //查找Nuget引用

/**
 * 获取路径下符合过滤条件的项目列表
 * @param path 路径
 * @param projects 项目列表
 * @param extension 文件扩展名过滤
 */

function GetProjects(path: string, projects: Project[], extension: string) {
  for (const f of Deno.readDirSync(path)) {
    if (f.isDirectory && !f.name.startsWith(".")) {
      GetProjects(path + SEP + f.name, projects, extension);
    } else {
      if (f.isFile && f.name.endsWith(extension)) {
        projects.push(
          {
            name: f.name.replace(extension, ""),
            loaction: path + SEP + f.name,
            refProjects: [],
          },
        );
      }
    }
  }
}

/**
 * 将项目Nuget引用转换为源码引用
 * @param current 当前项目
 * @param list 项目列表
 */

function ToggleProject(current: Project, list: Project[]) {
  let xmlContent = Deno.readTextFileSync(current.loaction);
  let isChanged = false;
  let m;
  while ((m = regex.exec(xmlContent)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    if (m.length > 1) {
      current.refProjects.push(
        { name: m[1], loaction: m[0], refProjects: [] },
      );
    }
  }
  if (current.refProjects.length > 0) {
    for (const refp of current.refProjects) {
      let matches = list.filter((r) => r.name === refp.name);
      if (matches.length > 0) {
        isChanged = true;
        log.info(`Nuget引用${refp.loaction}, 路径引用为 ${matches[0].loaction}`);
        xmlContent = xmlContent.replace(
          refp.loaction,
          `<ProjectReference Include="${matches[0].loaction}" />`,
        );
      }
    }
  }
  if (isChanged) {
    log.info(`${current.name}需要修改的Nuget引用`);
    Deno.writeTextFileSync(current.loaction, xmlContent);
  }
}

function main() {
  let cli = cac("PackageSourceToggle");
  cli.option("-s,--source <Dir>", "source ,Default is current path", {
    default: Deno.cwd(),
  });
  cli.option("-p,--package <Dir>", "package ,Default is current path", {
    default: Deno.cwd(),
  });
  cli.help();
  cli.version("0.0.1");
  let argOption = cli.parse().options;
  const option: Option = {
    PackageDir: argOption["package"],
    SourceDir: argOption["source"],
  };

  const projects: Project[] = [];
  GetProjects(option.SourceDir, projects, ".csproj");
  for (const p of projects) {
    ToggleProject(p, projects);
  }
}

main();

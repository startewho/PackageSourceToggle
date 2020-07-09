import { log, path} from "./deps.ts";

// @deno-types="https://unpkg.com/cac/mod.d.ts"
import { cac } from "https://unpkg.com/cac/mod.js";

interface Option {
  SourceDir: string;
  PackageDir: string;
  PackageFliter: string;
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

function GetProjects(curpath: string, projects: Project[], extension: string) {
  for (const f of Deno.readDirSync(curpath)) {
    let subPath = curpath + path.SEP + f.name;
    if (f.isDirectory && !f.name.startsWith(".")) {
      GetProjects(subPath, projects, extension);
    } else {
      if (f.isFile && f.name.endsWith(extension)) {
        projects.push(
          {
            name: f.name.replace(extension, ""),
            loaction: subPath,
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
 * @param fliter 过滤条件(只有包含fliter才进行处理)
 */

function ToggleProject(current: Project, list: Project[], fliter: string) {
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
      if (refp.name.includes(fliter)||fliter.length==0) {
        let matches = list.filter((r) => r.name === refp.name);
        if (matches.length > 0) {
          isChanged = true;
          let fromDir=path.dirname(current.loaction);
          let toDir=path.dirname(matches[0].loaction);
          let relativePath=path.relative(fromDir,toDir);
          let fileName=path.basename(matches[0].loaction);
          let relativeFileName=path.join(relativePath,fileName);
          log.info(`Nuget引用${refp.loaction}, 路径引用为 ${matches[0].loaction} 相对路径为${relativeFileName}`);
          xmlContent = xmlContent.replace(
            refp.loaction,
            `<ProjectReference Include="${relativeFileName}" />`,
          );
        }
      }
    }
  }
  if (isChanged) {
    log.info(`${current.name}需要修改的Nuget引用`);
    Deno.writeTextFileSync(current.loaction, xmlContent);
  }
}

/**
 * 获取相对于目标路径的相对路径
 * @param curPath 当前路径
 * @param targetPath 相对于路径
 * @returns 相对路径
 */
function getRelaivePath(curPath:string,targetPath:string):string{

  let curPathList=curPath.split("\\");
  let targetPathList=targetPath.split("\\");
  if(curPathList.length>0&&targetPathList.length>0)
  {
    //没有在一个根目录下
    if(curPathList[0]!=targetPathList[0]) 
    return curPath;
  }

  return "";
}

function main() {
  let cli = cac("PackageSourceToggle");
  cli.option("-s,--source <Dir>", "source ,Default is current path", {
    default: Deno.cwd(),
  });
  cli.option("-p,--package <Dir>", "package ,Default is current path", {
    default: Deno.cwd(),
  });
  cli.option("-f,--fliter <Dir>", "fliter ,mathched package name will toggle", {
    default: "",
  });
  cli.help(null);
  cli.version("0.0.1");
  let argOption = cli.parse().options;
  const option: Option = {
    PackageDir: argOption["package"],
    SourceDir: argOption["source"],
    PackageFliter: argOption["fliter"],
  };

  const projects: Project[] = [];
  GetProjects(option.SourceDir, projects, ".csproj");
  for (const p of projects) {
    ToggleProject(p, projects, option.PackageFliter);
  }
}

main();

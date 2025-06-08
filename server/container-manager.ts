import Docker from "dockerode";
import getPort from "get-port";
import fs from "fs";
import path from "path";

const docker =
  process.platform === "win32"
    ? new Docker({ socketPath: "//./pipe/docker_engine" })
    : new Docker({ socketPath: "/var/run/docker.sock" });

// Track active containers by user
const activeContainers = new Map<number, string[]>();

// Subject → Docker Image Mapping
const subjectToImage: Record<string, string> = {
  "JavaScript": "codespace-javascript",
  "Java": "codespace-java",
  "C++": "codespace-cpp",
  "Python": "codespace-python"
};

/**
 * Spins up a subject-specific container for a given user.
 * Cleans up any existing containers for the user first.
 */
export async function spinUpContainer(subject: string, userId: number) {
  // Clean up any existing containers for this user first
  await cleanupUserContainers(userId);

  const hostPort = await getPort();

  const image = subjectToImage[subject];
  if (!image) throw new Error(`No Docker image defined for subject: ${subject}`);

  const containerName = `codespace_${userId}_${Date.now()}`;

  const workspacePath = path.join(process.cwd(), "template-workspace");
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath);
    fs.writeFileSync(path.join(workspacePath, "README.md"), "# Welcome to your workspace");
  }

  // const container = await docker.createContainer({
  //   name: containerName,
  //   Image: image,
  //   Tty: true,
  //   ExposedPorts: { "8080/tcp": {} },
  //   Env: ["CS_DISABLE_IFRAME_PROTECTION=true"],
  //   Cmd: [
  //     "code-server",
  //     "--bind-addr", "0.0.0.0:8080",
  //     "--auth", "none"
  //   ],
  //   HostConfig: {
  //     PortBindings: {
  //       "8080/tcp": [{ HostPort: hostPort.toString() }]
  //     },
  //     // Optional: bind local workspace
  //     // Binds: [`${workspacePath}:/home/coder/project`],
  //     AutoRemove: true
  //   }
  // });
  const container = await docker.createContainer({
  name: containerName,
  Image: image,
  Tty: true,
  ExposedPorts: { "8080/tcp": {} },
  Env: ["CS_DISABLE_IFRAME_PROTECTION=true"],
  Cmd: [
    "code-server",
    "--bind-addr", "0.0.0.0:8080",
    "--auth", "none",
    "/home/coder/code-server/project"  // 👈 Trust-safe path
  ],
  HostConfig: {
    PortBindings: {
      "8080/tcp": [{ HostPort: hostPort.toString() }]
    },
    Binds: [`${workspacePath}:/home/coder/code-server/project`],  // 👈 Trusted path
    AutoRemove: true
  }
});


  await container.start();

  const data = await container.inspect();
  const portInfo = data.NetworkSettings.Ports["8080/tcp"];
  const hostMappedPort = portInfo?.[0]?.HostPort;

  if (!hostMappedPort) {
    throw new Error("❌ Could not determine mapped host port for container");
  }

  const containerId = data.Id;
  const url = `http://localhost:${hostMappedPort}`;
  console.log("🚀 VS Code server running at:", url);

  // Track this container for the user
  if (!activeContainers.has(userId)) {
    activeContainers.set(userId, []);
  }
  activeContainers.get(userId)!.push(containerId);

  const logs = await container.logs({ stdout: true, stderr: true });
  console.log("🪵 Container logs:\n", logs.toString());

  return { url, containerId };
}

/**
 * Stops and removes the container by ID.
 */
export async function stopContainer(containerId: string) {
  const container = docker.getContainer(containerId);
  try {
    await container.stop();
    console.log(`🛑 Stopped container: ${containerId}`);
    
    // Remove from tracking
    for (const [userId, containers] of activeContainers.entries()) {
      const index = containers.indexOf(containerId);
      if (index > -1) {
        containers.splice(index, 1);
        if (containers.length === 0) {
          activeContainers.delete(userId);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`❌ Error stopping container:`, err);
  }
}

/**
 * Clean up all containers for a specific user
 */
export async function cleanupUserContainers(userId: number) {
  const userContainers = activeContainers.get(userId) || [];
  
  for (const containerId of userContainers) {
    try {
      const container = docker.getContainer(containerId);
      await container.stop();
      console.log(`🧹 Cleaned up container: ${containerId} for user: ${userId}`);
    } catch (err) {
      console.log(`⚠️ Container ${containerId} may already be stopped`);
    }
  }
  
  // Clear the user's container list
  activeContainers.delete(userId);
}

/**
 * Clean up all containers on server shutdown
 */
export async function cleanupAllContainers() {
  console.log("🧹 Cleaning up all containers...");
  
  for (const [userId, containers] of activeContainers.entries()) {
    await cleanupUserContainers(userId);
  }
  
  activeContainers.clear();
  console.log("✅ All containers cleaned up");
}


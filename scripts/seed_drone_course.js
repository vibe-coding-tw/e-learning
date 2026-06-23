const admin = require("firebase-admin");

const PROJECT_ID = "e-learning-942f7";

if (!admin.apps.length) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:29099";
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
const NOW = admin.firestore.FieldValue.serverTimestamp();

const UNITS = [
  // ── Lesson 01: Flight Dynamics ──
  {
    lessonIdx: 1,
    unitIdx: 1,
    slug: "rigid-body-dynamics",
    title: "6-DoF 剛體動力學與 Three.js 渲染",
    titleEn: "6-DoF Rigid Body Dynamics & Three.js Rendering",
    summary: "從 6-DoF 剛體動力學模型出發，透過 Three.js WebGL 渲染管線與 requestAnimationFrame 物理主循環，實現無人機的高保真模擬。",
    summaryEn: "Build a high-fidelity drone simulation starting from 6-DoF rigid body dynamics, using the Three.js WebGL rendering pipeline with requestAnimationFrame physics loop.",
    coreContent: [
      "6-DoF 剛體平移與旋轉數學物理模型",
      "Three.js WebGL 渲染管線與 requestAnimationFrame 物理主循環",
      "半隱式 Euler 積分法（Euler-Cromer）數值積分",
    ],
    coreContentEn: [
      "6-DoF rigid body translation and rotation physics",
      "Three.js WebGL rendering pipeline with requestAnimationFrame physics loop",
      "Semi-implicit Euler-Cromer integration",
    ],
  },
  {
    lessonIdx: 1,
    unitIdx: 2,
    slug: "pid-simulation",
    title: "串級 PID 與定點懸停控制",
    titleEn: "Cascaded PID & Precision Hover Control",
    summary: "設計串級 PID 外環位置/內環姿態解耦控制邏輯，實現無人機的精準垂直起飛、定點懸停與安全降落。",
    summaryEn: "Design cascaded PID outer-loop position / inner-loop attitude control logic for precise vertical takeoff, hover, and landing.",
    coreContent: [
      "串級 PID 外環位置/內環姿態解耦控制邏輯",
      "定點懸停與安全降落控制策略",
    ],
    coreContentEn: [
      "Cascaded PID outer-loop position / inner-loop attitude control",
      "Precision hover and landing control strategies",
    ],
  },
  {
    lessonIdx: 1,
    unitIdx: 3,
    slug: "wind-correction",
    title: "Dryden 風場模擬與修正帳簿",
    titleEn: "Dryden Wind Model & Correction Ledger",
    summary: "導入 Dryden 風場模型進行干擾測試，並透過修正帳簿（Correction Ledger）進行飛控日誌調優與 Vibe/Agentic Coding 復盤。",
    summaryEn: "Introduce the Dryden wind turbulence model for disturbance testing, and use the Correction Ledger methodology for flight log tuning and Vibe/Agentic Coding debrief.",
    coreContent: [
      "Dryden 風場模型模擬與飛控日誌調優",
      "修正帳簿（Correction Ledger）與 Vibe/Agentic Coding 復盤",
    ],
    coreContentEn: [
      "Dryden wind turbulence simulation and flight log tuning",
      "Correction Ledger methodology and Vibe/Agentic Coding debrief",
    ],
  },
  // ── Lesson 02: PID Control ──
  {
    lessonIdx: 2,
    unitIdx: 1,
    slug: "cascade-pid-architecture",
    title: "級聯 PID 控制架構與增益整定",
    titleEn: "Cascade Control Architecture & PID Gain Tuning",
    summary: "深入級聯 PID 控制架構，掌握 P/I/D 三項增益的物理意義與內外環時間尺度解耦的整定順序。",
    summaryEn: "Master the cascaded PID control architecture, the physical meaning of P/I/D gains, and the inner/outer loop time-scale decoupling tuning sequence.",
    coreContent: [
      "級聯控制（Cascade Control）架構與內外環時間尺度解耦",
      "PID 三項增益（P/I/D）物理震盪症狀分析",
      "預調參對話（Pre-Tuning Conversation）Prompt 工程",
    ],
    coreContentEn: [
      "Cascade control architecture with inner/outer loop time-scale decoupling",
      "P/I/D gain physical oscillation symptom analysis",
      "Pre-Tuning Conversation prompt engineering",
    ],
  },
  {
    lessonIdx: 2,
    unitIdx: 2,
    slug: "turbulence-blackbox",
    title: "Dryden 湍流模型與黑盒子日誌分析",
    titleEn: "Dryden Turbulence Model & Blackbox Log Analysis",
    summary: "透過 Dryden 極限風場測試與飛控黑盒子日誌分析，掌握時域/頻譜分析方法。",
    summaryEn: "Master time-domain and spectrum analysis through Dryden extreme wind testing and flight controller blackbox log analysis.",
    coreContent: [
      "Dryden 大氣湍流模型與成形濾波器離散化",
      "黑盒子日誌（Blackbox Log）時域/頻譜分析",
    ],
    coreContentEn: [
      "Dryden turbulence forming filter discretization",
      "Blackbox log time-domain and spectrum analysis",
    ],
  },
  {
    lessonIdx: 2,
    unitIdx: 3,
    slug: "ai-prompt-tuning",
    title: "數據驅動的 AI 提示調參與物理護欄",
    titleEn: "Data-Driven AI Prompt Tuning & Physical Guardrails",
    summary: "利用 AI 進行數據驅動的參數優化，同時設計物理護欄確保安全邊界。",
    summaryEn: "Leverage AI for data-driven parameter optimization while designing physical safety guardrails.",
    coreContent: [
      "數據驅動的 AI 提示調參與物理護欄設計",
    ],
    coreContentEn: [
      "Data-driven AI prompt tuning with physical safety guardrails",
    ],
  },
  // ── Lesson 03: OpenCV Tracking ──
  {
    lessonIdx: 3,
    unitIdx: 1,
    slug: "hsv-morphology",
    title: "HSV 顏色遮罩與形態學影像處理",
    titleEn: "HSV Color Masking & Morphological Image Processing",
    summary: "整合下視相機與 OpenCV 視覺管線，掌握 HSV 顏色遮罩、形態學操作與影像矩質心定位。",
    summaryEn: "Integrate a downward-facing camera with OpenCV processing pipeline. Master HSV masking, morphological operations, and image moment centroid computation.",
    coreContent: [
      "HSV 顏色空間與二值化遮罩（Color Masking）",
      "形態學操作（Erosion/Dilation）與影像矩（Image Moments）質心定位",
    ],
    coreContentEn: [
      "HSV color space and binary masking",
      "Morphological operations and image moment centroid computation",
    ],
  },
  {
    lessonIdx: 3,
    unitIdx: 2,
    slug: "hu-moments-calibration",
    title: "Hu 不變矩與相機標定",
    titleEn: "Hu Invariant Moments & Camera Calibration",
    summary: "使用 Hu 不變矩與圓度形狀描述子進行地標辨識，並透過相機標定與逆透視變換實現精確定位。",
    summaryEn: "Use Hu invariant moments and roundness shape descriptors for landmark recognition, with camera calibration and Inverse Perspective Mapping.",
    coreContent: [
      "Hu 不變矩與圓度（Roundness）形狀描述子",
      "相機標定與逆透視變換（IPM）",
    ],
    coreContentEn: [
      "Hu invariant moments and roundness shape descriptors",
      "Camera calibration and Inverse Perspective Mapping",
    ],
  },
  {
    lessonIdx: 3,
    unitIdx: 3,
    slug: "landing-state-machine",
    title: "多階段降落狀態機與 AI 語法防禦",
    titleEn: "Multi-Stage Landing State Machine & AI Syntax Defense",
    summary: "設計多階段級聯降落狀態機，並學習避免 AI 語法幻覺（OpenCV 廢棄常量、零除保護）。",
    summaryEn: "Design a multi-stage cascaded landing state machine and learn to avoid AI syntax hallucinations (deprecated OpenCV APIs, zero-division).",
    coreContent: [
      "多階段級聯降落狀態機設計",
      "避免 AI 語法幻覺（OpenCV 廢棄常量、零除保護）",
    ],
    coreContentEn: [
      "Multi-stage cascaded landing state machine",
      "AI syntax hallucination avoidance (deprecated OpenCV APIs, zero-division)",
    ],
  },
  // ── Lesson 04: YOLOv8-Pose ──
  {
    lessonIdx: 4,
    unitIdx: 1,
    slug: "yolo-architecture",
    title: "YOLOv8-Pose 模型架構與 OKS 評估",
    titleEn: "YOLOv8-Pose Architecture & OKS Metric",
    summary: "了解 YOLOv8-Pose 單階段姿態估計模型架構與 Object Keypoint Similarity (OKS) 評估指標。",
    summaryEn: "Understand the YOLOv8-Pose single-stage pose estimation architecture and the Object Keypoint Similarity (OKS) evaluation metric.",
    coreContent: [
      "YOLOv8-Pose 單階段姿態估計模型架構",
      "Object Keypoint Similarity (OKS) 評估指標",
    ],
    coreContentEn: [
      "YOLOv8-Pose single-stage pose estimation architecture",
      "Object Keypoint Similarity (OKS) metric",
    ],
  },
  {
    lessonIdx: 4,
    unitIdx: 2,
    slug: "tensorrt-export",
    title: "PyTorch → ONNX → TensorRT 轉譯管線",
    titleEn: "PyTorch → ONNX → TensorRT Export Pipeline",
    summary: "建構從 PyTorch 到 TensorRT 的一鍵轉譯管線，實現 Jetson Orin 邊緣裝置上的高效部署。",
    summaryEn: "Build a one-click PyTorch-to-TensorRT export pipeline for efficient deployment on Jetson Orin edge devices.",
    coreContent: [
      "PyTorch → ONNX → TensorRT 一鍵轉譯管線",
      "GPU 前處理管線（Letterbox/NCHW/CUDA）",
    ],
    coreContentEn: [
      "PyTorch → ONNX → TensorRT automated export pipeline",
      "GPU-accelerated preprocessing pipeline (Letterbox/NCHW/CUDA)",
    ],
  },
  {
    lessonIdx: 4,
    unitIdx: 3,
    slug: "int8-visual-servoing",
    title: "INT8 量化部署與視覺伺服控制",
    titleEn: "INT8 Quantization & Visual Servoing",
    summary: "透過 INT8 後量化（PTQ）與 KL 散度校準實現 30FPS+ 即時推理，並整合視覺伺服閉環控制。",
    summaryEn: "Achieve 30FPS+ real-time inference via INT8 PTQ quantization with KL-divergence calibration, integrated with visual servoing closed-loop control.",
    coreContent: [
      "INT8 後量化（PTQ）與 KL 散度校準",
      "Visual Servoing 視覺伺服閉環與硬體鎖頻優化",
    ],
    coreContentEn: [
      "INT8 Post-Training Quantization with KL-divergence calibration",
      "Visual servoing closed-loop control with jetson_clocks optimization",
    ],
  },
  // ── Lesson 05: SLAM Mapping ──
  {
    lessonIdx: 5,
    unitIdx: 1,
    slug: "optical-flow-lidar",
    title: "光流陀螺儀補償與 2D LiDAR 點雲",
    titleEn: "Optical Flow Compensation & 2D LiDAR Point Cloud",
    summary: "在無 GPS 室內環境中，整合光流感測器與 2D LiDAR，學習光流陀螺儀補償與點雲解析。",
    summaryEn: "In GPS-denied indoor environments, integrate optical flow sensors with 2D LiDAR, learning gyroscopic compensation and point cloud parsing.",
    coreContent: [
      "光流陀螺儀補償（Gyroscopic Compensation）與淨平移光流解算",
      "2D LiDAR 點雲解析與佔據網格地圖（Occupancy Grid）",
    ],
    coreContentEn: [
      "Optical flow gyroscopic compensation and net translational flow",
      "2D LiDAR point cloud parsing and Occupancy Grid mapping",
    ],
  },
  {
    lessonIdx: 5,
    unitIdx: 2,
    slug: "bayes-occupancy",
    title: "二進位貝氏濾波器與佔據地圖更新",
    titleEn: "Binary Bayes Filter & Occupancy Map Update",
    summary: "使用二進位貝氏濾波器 log-odds 方法進行佔據網格地圖的增量更新。",
    summaryEn: "Use the Binary Bayes filter log-odds method for incremental occupancy grid map updates.",
    coreContent: [
      "二進位貝氏濾波器 log-odds 地圖更新",
      "動態地圖擴展與盲飛避障狀態機",
    ],
    coreContentEn: [
      "Binary Bayes filter log-odds map update",
      "Dynamic map expansion and blind-flying collision avoidance state machine",
    ],
  },
  {
    lessonIdx: 5,
    unitIdx: 3,
    slug: "pose-graph-slam",
    title: "Pose Graph SLAM 與 ROS 2 節點",
    titleEn: "Pose Graph SLAM & ROS 2 Nodes",
    summary: "實作 Pose Graph SLAM 後端優化與迴路閉合，並使用 ROS 2 rclpy 設計非阻塞訂閱節點。",
    summaryEn: "Implement Pose Graph SLAM backend optimization with loop closure, and design non-blocking ROS 2 rclpy subscriber nodes.",
    coreContent: [
      "Pose Graph SLAM 後端優化與迴路閉合（Loop Closure）",
      "ROS 2 rclpy 非阻塞訂閱節點設計",
    ],
    coreContentEn: [
      "Pose Graph SLAM backend optimization with Loop Closure",
      "ROS 2 rclpy non-blocking subscriber node design",
    ],
  },
  // ── Lesson 06: Path Planning ──
  {
    lessonIdx: 6,
    unitIdx: 1,
    slug: "a-star-search",
    title: "A* 啟發式搜尋演算法",
    titleEn: "A* Heuristic Search Algorithm",
    summary: "在 ROS 2 C++ 環境中實現 A* 啟發式搜尋演算法（f = g + h），使用 std::priority_queue 建構尋路引擎。",
    summaryEn: "Implement the A* heuristic search algorithm (f = g + h) in ROS 2 C++ using std::priority_queue for the pathfinding engine.",
    coreContent: [
      "A* 啟發式搜尋演算法（f = g + h）",
      "ROS 2 C++ colcon 編譯與 std::priority_queue 尋路引擎",
    ],
    coreContentEn: [
      "A* heuristic search algorithm (f = g + h)",
      "ROS 2 C++ colcon build with std::priority_queue pathfinding",
    ],
  },
  {
    lessonIdx: 6,
    unitIdx: 2,
    slug: "rrt-star-trajectory",
    title: "RRT* 與 Minimum Snap 軌跡平滑",
    titleEn: "RRT* & Minimum Snap Trajectory Smoothing",
    summary: "實作 RRT* 漸近最優隨機採樣與 Rewire 重連優化，並結合 Minimum Snap 多項式軌跡平滑。",
    summaryEn: "Implement RRT* asymptotically optimal sampling with Rewire optimization, combined with Minimum Snap polynomial trajectory smoothing.",
    coreContent: [
      "RRT* 漸近最優隨機採樣與 Rewire 重連優化",
      "Minimum Snap 多項式軌跡平滑（C3 連續）",
    ],
    coreContentEn: [
      "RRT* asymptotically optimal sampling with Rewire optimization",
      "Minimum Snap polynomial trajectory smoothing (C3 continuity)",
    ],
  },
  {
    lessonIdx: 6,
    unitIdx: 3,
    slug: "dynamic-replanning",
    title: "動態重規劃與記憶體安全",
    titleEn: "Dynamic Replanning & Memory Safety",
    summary: "穿越未知移動障礙物森林，實現動態重規劃狀態機並確保 C++ 記憶體安全。",
    summaryEn: "Navigate unknown moving obstacle forests with dynamic replanning state machines and C++ memory safety.",
    coreContent: [
      "動態重規劃（Dynamic Replanning）狀態機",
      "C++ 記憶體安全護欄（智慧指標、邊界剪裁）",
    ],
    coreContentEn: [
      "Dynamic replanning state machine",
      "C++ memory safety guardrails (smart pointers, acceleration clipping)",
    ],
  },
  // ── Lesson 07: Communication FSM ──
  {
    lessonIdx: 7,
    unitIdx: 1,
    slug: "fsm-emergency",
    title: "FSM 模型與斷鏈應變流程",
    titleEn: "FSM Model & Link-Loss Emergency Response",
    summary: "設計高可靠性有限狀態機以應對 RC 斷鏈、GPS 訊號遺失與低電量等致命威脅。",
    summaryEn: "Design a fail-safe finite state machine for RC link-loss, GNSS outage, and low-battery emergencies.",
    coreContent: [
      "有限狀態機（FSM）數學模型與狀態轉移矩陣",
      "RC 斷鏈／GPS 遺失／低電量自動應變流程",
    ],
    coreContentEn: [
      "Finite State Machine mathematical model and transition matrix",
      "Auto-response flows for RC link-loss, GNSS outage, low battery",
    ],
  },
  {
    lessonIdx: 7,
    unitIdx: 2,
    slug: "vio-filtering",
    title: "視覺慣性里程計與 IMU 互補濾波",
    titleEn: "Visual-Inertial Odometry & IMU Complementary Filtering",
    summary: "整合視覺慣性里程計（VIO）與 IMU 互補濾波，實現無 GNSS 環境下的自主導航。",
    summaryEn: "Integrate Visual-Inertial Odometry (VIO) with IMU complementary filtering for autonomous navigation without GNSS.",
    coreContent: [
      "視覺慣性里程計（VIO）與 IMU 互補濾波",
    ],
    coreContentEn: [
      "Visual-Inertial Odometry (VIO) with IMU complementary filtering",
    ],
  },
  {
    lessonIdx: 7,
    unitIdx: 3,
    slug: "ekf-health-monitor",
    title: "卡爾曼濾波融合與健康監控",
    titleEn: "EKF Sensor Fusion & Health Monitor",
    summary: "使用 Extended Kalman Filter 進行感測器融合，並設計 SDK 異步健康監控告警節點與 FSM 防呆機制。",
    summaryEn: "Use Extended Kalman Filter for sensor fusion and design an SDK asynchronous health monitor alert node with FSM foolproof safeguards.",
    coreContent: [
      "卡爾曼濾波（Extended Kalman Filter）感測器融合",
      "SDK 異步健康監控告警節點（Health Monitor）",
      "FSM 防呆設計：非衝突狀態轉移與安全退出通道",
    ],
    coreContentEn: [
      "Extended Kalman Filter sensor fusion",
      "SDK asynchronous health monitor node",
      "FSM foolproof design: conflict-free transitions and safe egress",
    ],
  },
  // ── Lesson 08: CI/CD ──
  {
    lessonIdx: 8,
    unitIdx: 1,
    slug: "github-actions-autograde",
    title: "GitHub Actions 與自動評分管線",
    titleEn: "GitHub Actions & Autograding Pipeline",
    summary: "建構 GitHub Actions 自動化評分管線，從 Workflow 語法到分數回寫 Firestore。",
    summaryEn: "Build GitHub Actions automated grading pipelines, from workflow syntax to score write-back to Firestore.",
    coreContent: [
      "GitHub Actions Workflow 語法與矩陣策略建置",
      "自動評分腳本撰寫與分數回寫 Firestore",
    ],
    coreContentEn: [
      "GitHub Actions workflow syntax and matrix build strategies",
      "Automated grading script writing with score write-back to Firestore",
    ],
  },
  {
    lessonIdx: 8,
    unitIdx: 2,
    slug: "docker-semantic-release",
    title: "Docker 容器化與版本號管理",
    titleEn: "Docker Containerization & Semantic Release",
    summary: "從 Docker 多階段建置到 Semantic Release 自動版本號管理，實現可重現的建置環境。",
    summaryEn: "From Docker multi-stage builds to Semantic Release automated versioning, achieve reproducible build environments.",
    coreContent: [
      "Docker 容器化封裝與多階段建置（Multi-stage Build）",
      "Semantic Release 自動版本號管理",
    ],
    coreContentEn: [
      "Docker containerization with multi-stage builds",
      "Semantic Release automated version management",
    ],
  },
  {
    lessonIdx: 8,
    unitIdx: 3,
    slug: "cicd-deployment",
    title: "一鍵打包部署與 CI/CD 安全護欄",
    titleEn: "One-Click Deploy & CI/CD Security Guardrails",
    summary: "一鍵打包部署至 Firebase Hosting / Cloud Run，並建立 CI/CD 管線安全護欄。",
    summaryEn: "One-click deploy to Firebase Hosting / Cloud Run with CI/CD security guardrails.",
    coreContent: [
      "一鍵打包部署至 Firebase Hosting / Cloud Run",
      "CI/CD 管線安全護欄（Secret 管理、Branch Protection）",
    ],
    coreContentEn: [
      "One-click deploy to Firebase Hosting / Cloud Run",
      "CI/CD security guardrails (Secrets management, Branch Protection)",
    ],
  },
  // ── Lesson 09: Multimodal Streaming ──
  {
    lessonIdx: 9,
    unitIdx: 1,
    slug: "rtsp-protocol",
    title: "RTSP 即時串流與 SDP 會話描述",
    titleEn: "RTSP Streaming & SDP Session Description",
    summary: "透過 RTSP 即時串流協議與 SDP 會話描述，實現無人機機載影像的低延遲傳輸。",
    summaryEn: "Implement low-latency drone video streaming via RTSP protocol and SDP session description.",
    coreContent: [
      "RTSP 即時串流協議與 SDP 會話描述",
      "LMS（Lightweight Message Streaming）輕量通訊協議",
    ],
    coreContentEn: [
      "RTSP streaming protocol and SDP session description",
      "LMS (Lightweight Message Streaming) protocol",
    ],
  },
  {
    lessonIdx: 9,
    unitIdx: 2,
    slug: "gstreamer-codec",
    title: "GStreamer 硬體加速編解碼",
    titleEn: "GStreamer Hardware-Accelerated Codec",
    summary: "使用 GStreamer 管線進行 H.264/H.265 硬體加速編解碼，並實現頻寬自適應編碼與動態解析度調整。",
    summaryEn: "Use GStreamer pipeline for H.264/H.265 hardware-accelerated encoding with bandwidth-adaptive scaling.",
    coreContent: [
      "GStreamer 管線硬體加速編解碼（H.264/H.265）",
      "頻寬自適應編碼與動態解析度調整",
    ],
    coreContentEn: [
      "GStreamer hardware-accelerated codec pipeline (H.264/H.265)",
      "Bandwidth-adaptive encoding and dynamic resolution scaling",
    ],
  },
  {
    lessonIdx: 9,
    unitIdx: 3,
    slug: "cloud-ai-latency",
    title: "雲端 AI 協同處理與延遲預算",
    titleEn: "Cloud AI Co-Processing & Latency Budget",
    summary: "設計 Edge + Cloud Fallback 架構，進行端到端延遲預算分析與最佳化。",
    summaryEn: "Design Edge + Cloud Fallback architecture with end-to-end latency budget analysis and optimization.",
    coreContent: [
      "雲端 AI 協同處理架構（Inference at Edge + Cloud Fallback）",
      "端到端延遲預算分析與最佳化",
    ],
    coreContentEn: [
      "Cloud AI co-processing architecture (Edge + Cloud fallback)",
      "End-to-end latency budget analysis and optimization",
    ],
  },
  // ── Lesson 10: WebRTC Dashboard ──
  {
    lessonIdx: 10,
    unitIdx: 1,
    slug: "webrtc-architecture",
    title: "WebRTC 架構與 NAT 穿透",
    titleEn: "WebRTC Architecture & NAT Traversal",
    summary: "了解 WebRTC PeerConnection、SDP Offer/Answer 與 ICE 候選機制，部署 STUN/TURN 伺服器實現 NAT 穿透。",
    summaryEn: "Understand WebRTC PeerConnection, SDP Offer/Answer and ICE candidates, deploy STUN/TURN servers for NAT traversal.",
    coreContent: [
      "WebRTC 架構：PeerConnection、SDP Offer/Answer、ICE 候選",
      "STUN/TURN 伺服器部署與 NAT 穿透策略",
    ],
    coreContentEn: [
      "WebRTC architecture: PeerConnection, SDP Offer/Answer, ICE candidates",
      "STUN/TURN server deployment and NAT traversal",
    ],
  },
  {
    lessonIdx: 10,
    unitIdx: 2,
    slug: "browser-dashboard",
    title: "瀏覽器即時儀表板與 MediaStream",
    titleEn: "Browser Dashboard & MediaStream",
    summary: "整合瀏覽器端 WebRTC API 與 MediaStream 處理，建構飛控 Telemetry 即時圖表與 Video Panel。",
    summaryEn: "Integrate browser WebRTC API with MediaStream processing to build real-time telemetry charts and video panels.",
    coreContent: [
      "瀏覽器端 WebRTC API 整合與 MediaStream 處理",
      "Web 儀表板：飛控 Telemetry 即時圖表與 Video Panel",
    ],
    coreContentEn: [
      "Browser WebRTC API integration with MediaStream handling",
      "Web dashboard: real-time telemetry charts and video panel",
    ],
  },
  {
    lessonIdx: 10,
    unitIdx: 3,
    slug: "datachannel-multi",
    title: "DataChannel 雙向通訊與多機佈局",
    titleEn: "DataChannel Bidirectional Comms & Multi-Drone Layout",
    summary: "使用 DataChannel 實現雙向低延遲指令下發，並設計多機併行畫面 Tile 佈局與動態切換。",
    summaryEn: "Use DataChannel for bidirectional low-latency command dispatch with multi-drone tiled layout and dynamic switching.",
    coreContent: [
      "DataChannel 雙向低延遲指令下發",
      "多機併行畫面 Tile 佈局與動態切換",
    ],
    coreContentEn: [
      "DataChannel bidirectional low-latency command dispatch",
      "Multi-drone tiled layout with dynamic switching",
    ],
  },
  // ── Lesson 11: Swarm Coordination ──
  {
    lessonIdx: 11,
    unitIdx: 1,
    slug: "consensus-graph",
    title: "一致性演算法與圖論基礎",
    titleEn: "Consensus Algorithms & Graph Theory",
    summary: "從圖論基礎出發，實現多無人機蜂群一致性協同控制演算法。",
    summaryEn: "Start from graph theory foundations to implement multi-drone swarm consensus control algorithms.",
    coreContent: [
      "一致性演算法（Consensus Algorithm）與圖論基礎",
      "無線通訊拓樸（Broadcast / Mesh / Star）",
    ],
    coreContentEn: [
      "Consensus algorithms and graph theory foundations",
      "Wireless communication topologies (Broadcast/Mesh/Star)",
    ],
  },
  {
    lessonIdx: 11,
    unitIdx: 2,
    slug: "leader-follower",
    title: "領航-跟隨編隊與任務分配",
    titleEn: "Leader-Follower Formation & Task Allocation",
    summary: "實作領航-跟隨編隊控制與分散式任務分配的市場機制。",
    summaryEn: "Implement leader-follower formation control with auction-based distributed task allocation.",
    coreContent: [
      "領航-跟隨（Leader-Follower）編隊控制",
      "分散式任務分配與市場機制（Auction-based）",
    ],
    coreContentEn: [
      "Leader-Follower formation control",
      "Distributed task allocation with auction-based mechanisms",
    ],
  },
  {
    lessonIdx: 11,
    unitIdx: 3,
    slug: "crazyswarm-bridge",
    title: "Crazyswarm 生態系與多機避碰",
    titleEn: "Crazyswarm Ecosystem & Multi-Drone Collision Avoidance",
    summary: "整合 Crazyswarm 生態系（CFClient 與 ROS 2 橋接），並實現多機碰撞避免與動態拓樸重構。",
    summaryEn: "Integrate the Crazyswarm ecosystem (CFClient and ROS 2 bridge) with multi-drone collision avoidance and dynamic topology reconfiguration.",
    coreContent: [
      "Crazyswarm 生態系：CFClient 與 ROS 2 橋接",
      "多機碰撞避免與動態拓樸重構",
    ],
    coreContentEn: [
      "Crazyswarm ecosystem: CFClient and ROS 2 bridge",
      "Multi-drone collision avoidance and dynamic topology reconfiguration",
    ],
  },
  // ── Lesson 12: Final Review ──
  {
    lessonIdx: 12,
    unitIdx: 1,
    slug: "final-demo",
    title: "期末專題成果展示",
    titleEn: "Final Project Demo",
    summary: "各組進行無人機自主任務綜合成果展示：自主搜救、環境測繪或蜂群編隊。",
    summaryEn: "Team demo of integrated autonomous drone missions: search-and-rescue, environmental mapping, or swarm formation.",
    coreContent: [
      "期末專題成果展示：自主搜救／環境測繪／蜂群編隊",
    ],
    coreContentEn: [
      "Final project demo: autonomous search-and-rescue / environmental mapping / swarm formation",
    ],
  },
  {
    lessonIdx: 12,
    unitIdx: 2,
    slug: "correction-retro",
    title: "修正帳簿彙總與成長脈絡回顧",
    titleEn: "Correction Ledger Review & Growth Trajectory",
    summary: "針對整學期的修正帳簿進行全景復盤，從 Vibe Coding 到 Agentic Coding 的成長歷程回顧。",
    summaryEn: "Panoramic review of the semester's Correction Ledgers, from Vibe Coding to Agentic Coding growth journey.",
    coreContent: [
      "修正帳簿全學期彙總分析與模式識別",
      "Vibe Coding → Agentic Coding 成長脈絡回顧",
      "系統性工程思維與物理直覺培養總結",
    ],
    coreContentEn: [
      "Semester-long Correction Ledger aggregation and pattern recognition",
      "Vibe Coding → Agentic Coding growth trajectory review",
      "Systematic engineering thinking and physical intuition cultivation",
    ],
  },
  {
    lessonIdx: 12,
    unitIdx: 3,
    slug: "career-feedback",
    title: "職涯連結與教學回饋",
    titleEn: "Career Pathways & Course Feedback",
    summary: "職涯連結：邊緣運算／機器人／AI 產業方向，並進行翻轉教室教學成效問卷與回饋。",
    summaryEn: "Career pathways in edge computing / robotics / AI, and flipped classroom effectiveness survey and feedback.",
    coreContent: [
      "職涯連結：邊緣運算／機器人／AI 產業方向",
      "翻轉教室教學成效問卷與回饋",
    ],
    coreContentEn: [
      "Career pathways: edge computing / robotics / AI industry",
      "Flipped classroom effectiveness survey and feedback",
    ],
  },
];

// Deduplicate: keep last occurrence per (lessonIdx, unitIdx)
const seen = new Set();
const UNITS_DEDUPED = [];
for (const u of UNITS) {
  const key = `${u.lessonIdx}-${u.unitIdx}`;
  if (seen.has(key)) continue;
  seen.add(key);
  UNITS_DEDUPED.push(u);
}

const LESSONS = [
  { index: 1, key: "01-flight-dynamics", title: "Vibe Coding 啟航與無人機動力學模擬", titleEn: "Vibe Coding Launch & Drone Flight Dynamics Simulation" },
  { index: 2, key: "02-pid-control", title: "飛控演算法：AI 輔助 PID 控制與日誌除錯", titleEn: "Flight Control: AI-Assisted PID Tuning & Log Debugging" },
  { index: 3, key: "03-opencv-tracking", title: "電腦視覺基礎：OpenCV 航道與地標追蹤", titleEn: "Computer Vision: OpenCV Line Tracking & Landmark Detection" },
  { index: 4, key: "04-yolov8-pose", title: "AI 目標辨識：YOLOv8-Pose 與邊緣端推理優化", titleEn: "AI Object Detection: YOLOv8-Pose & Edge Inference Optimization" },
  { index: 5, key: "05-slam-mapping", title: "未知環境感知：雷達、光流與 SLAM 地圖構建", titleEn: "Unknown Environment Perception: LiDAR, Optical Flow & SLAM Mapping" },
  { index: 6, key: "06-path-planning", title: "路徑規劃與動態避障：A* 與 RRT* 演算法轉譯", titleEn: "Path Planning & Dynamic Obstacle Avoidance: A* & RRT*" },
  { index: 7, key: "07-communication-fsm", title: "斷鏈生存：通訊異常狀態機與慣性/視覺導航", titleEn: "Link-Loss Survival: Comms FSM & Inertial/Visual Navigation" },
  { index: 8, key: "08-ci-cd", title: "敏捷開發：自動評分 GitHub Actions 與 CI/CD 一鍵打包", titleEn: "Agile Development: GitHub Actions Autograding & CI/CD Pipeline" },
  { index: 9, key: "09-multimodal-streaming", title: "多模態通訊：RTSP/LMS 串流與雲端處理", titleEn: "Multimodal Communication: RTSP/LMS Streaming & Cloud Processing" },
  { index: 10, key: "10-webrtc-dashboard", title: "基於 WebRTC 的即時影像交互與 Web 儀表板", titleEn: "WebRTC Real-Time Video & Web Dashboard" },
  { index: 11, key: "11-swarm-coordination", title: "蜂群協同：一致性演算法與多機任務分配", titleEn: "Swarm Coordination: Consensus Algorithms & Task Allocation" },
  { index: 12, key: "12-final-review", title: "期末成果展示與翻轉教室全景復盤", titleEn: "Final Demo & Flipped Classroom Retrospective" },
];

async function seedDatabase() {
  const batch = db.batch();
  const courseId = "drone-vibe-coding.html";

  // 1. Build course_units and unit titles
  const courseUnits = UNITS_DEDUPED.map(u => `drone-vibe-coding-${String(u.lessonIdx).padStart(2, "0")}-${String(u.unitIdx).padStart(2, "0")}-${u.slug}.html`);
  const courseUnitTitles = UNITS_DEDUPED.map(u => `${u.title}`);

  // 2. Write the main course document
  const courseRef = db.collection("metadata_lessons").doc(courseId);
  batch.set(courseRef, {
    id: courseId,
    docId: courseId,
    metadataType: "course",
    category: "drone-basic",
    level: "basic",
    track: "drone",
    orderWeight: 1,
    hiddenFromCatalog: false,
    isDeprecated: false,
    course_units: courseUnits,
    courseUnits: courseUnits,
    course_unit_titles: courseUnitTitles,
    courseUnitTitles: courseUnitTitles,
    i18n: {
      "zh-TW": {
        title: "無人機 Vibe Coding 翻轉教室課程",
        summary: "從動力學模擬、飛控 PID 至邊緣端 YOLOv8-Pose、3D SLAM 與蜂群協同控制，全面掌握 AI 協同開發（Agentic Coding）的工程嚴謹性。",
        description: "本課程整合翻轉教室（Flipped Classroom）與 AI 協同開發（Vibe/Agentic Coding）典範，帶領學生從 6-DoF 剛體動力學、串級 PID 控制、電腦視覺、邊緣 AI 推理、SLAM 導航到蜂群協同，建構完整的無人機自主系統開發能力。每堂課皆包含課前自主預習檢核、課堂 Vibe Coding 實作、極限沙盒對撞與修正帳簿技術復盤。",
        coreContent: [
          "6-DoF 剛體動力學與 Three.js 高保真模擬器建構",
          "串級 PID 控制、AI 輔助調參與 Dryden 風場測試",
          "OpenCV 視覺管線與 YOLOv8-Pose 邊緣端 INT8 量化部署",
          "2D LiDAR SLAM、A*/RRT* 路徑規劃與動態避障",
          "通訊異常 FSM、WebRTC 儀表板與 RTSP 影像串流",
          "Crazyswarm 蜂群一致性演算法與最終專題成果展示"
        ]
      },
      "en": {
        title: "Drone Vibe Coding - Flipped Classroom Course",
        summary: "From flight dynamics and PID control to YOLOv8-Pose edge AI, 3D SLAM, and swarm coordination—master the engineering rigor of Agentic Coding.",
        description: "This course integrates the flipped classroom model with AI-assisted Vibe/Agentic Coding paradigms. Students progress from 6-DoF rigid body dynamics, cascaded PID control, computer vision, edge AI inference, SLAM navigation to swarm coordination—building a complete autonomous drone system development capability.",
        coreContent: [
          "6-DoF rigid body dynamics and Three.js high-fidelity simulator",
          "Cascaded PID control, AI-assisted tuning, Dryden wind testing",
          "OpenCV vision pipeline and YOLOv8-Pose INT8 edge deployment",
          "2D LiDAR SLAM, A*/RRT* path planning, dynamic obstacle avoidance",
          "Comms failure FSM, WebRTC dashboard, RTSP video streaming",
          "Crazyswarm consensus algorithms and final capstone demo"
        ]
      }
    },
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: "seed-drone-course"
  }, { merge: true });
  console.log(`  [metadata_lessons] Queued course: ${courseId} (${courseUnits.length} units)`);

  // 4. Write 12 lesson plan docs (each with 3 sub-units)
  for (const lesson of LESSONS) {
    const lessonId = `drone-vibe-coding-lesson-${String(lesson.index).padStart(2, "0")}`;
    const lessonUnits = UNITS_DEDUPED.filter(u => u.lessonIdx === lesson.index);
    const lessonUnitFiles = lessonUnits.map(u => `drone-vibe-coding-${String(u.lessonIdx).padStart(2, "0")}-${String(u.unitIdx).padStart(2, "0")}-${u.slug}.html`);
    const lessonUnitTitles = lessonUnits.map(u => `${u.title}`);
    const coreContent = lessonUnits.flatMap(u => u.coreContent);
    const coreContentEn = lessonUnits.flatMap(u => u.coreContentEn);

    const lessonRef = db.collection("metadata_lessons").doc(lessonId);
    batch.set(lessonRef, {
      id: lessonId,
      docId: lessonId,
      metadataType: "lesson",
      category: "drone-basic",
      level: "basic",
      track: "drone",
      orderWeight: lesson.index,
      hiddenFromCatalog: true,
      isDeprecated: false,
      pilotOnly: true,
      lessonIndex: lesson.index,
      lessonLabel: `第 ${lesson.index} 課`,
      lessonLabelEn: `Lesson ${lesson.index}`,
      title: lesson.title,
      titleEn: lesson.titleEn,
      course_units: lessonUnitFiles,
      courseUnits: lessonUnitFiles,
      course_unit_titles: lessonUnitTitles,
      courseUnitTitles: lessonUnitTitles,
      i18n: {
        "zh-TW": {
          title: lesson.title,
          summary: lessonUnits.map(u => u.summary).filter(Boolean).join("；"),
          coreContent,
        },
        "en": {
          title: lesson.titleEn,
          summary: lessonUnits.map(u => u.summaryEn).filter(Boolean).join("; "),
          coreContent: coreContentEn,
        }
      },
      createdAt: NOW,
      updatedAt: NOW,
      updatedBy: "seed-drone-course"
    }, { merge: true });
    console.log(`  [metadata_lessons] Queued lesson: ${lessonId} (${lessonUnitFiles.length} units)`);
  }

  await batch.commit();
  console.log("\n✅ All documents written successfully!");
  console.log(`   Course: ${courseId}`);
  console.log(`   Units: ${UNITS_DEDUPED.length}`);
  console.log(`   Lessons: ${LESSONS.length}`);
}

seedDatabase().catch(e => {
  console.error("❌ Error seeding database:", e);
  process.exit(1);
});

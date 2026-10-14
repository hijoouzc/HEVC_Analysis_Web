/*
 * Standalone driver using the normal TAppEncoder lifecycle and optional HM trace hooks.
 */
#include <cstdlib>
#include <atomic>
#include <algorithm>
#include <chrono>
#include <exception>
#include <fstream>
#include <filesystem>
#include <functional>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <streambuf>
#include <thread>
#include <vector>

#include "TAppEncTop.h"
#include "Utilities/program_options_lite.h"

namespace
{
class TeeBuffer : public std::streambuf
{
public:
  TeeBuffer(std::streambuf* terminal, std::streambuf* file, std::mutex& outputMutex)
    : m_terminal(terminal), m_file(file), m_outputMutex(outputMutex) {}

protected:
  int overflow(int ch) override
  {
    std::lock_guard<std::mutex> lock(m_outputMutex);
    if (traits_type::eq_int_type(ch, traits_type::eof()))
    {
      const bool terminalOk = m_terminal->pubsync() == 0;
      const bool fileOk = m_file->pubsync() == 0;
      return (terminalOk && fileOk) ? traits_type::not_eof(ch) : traits_type::eof();
    }
    const char value = traits_type::to_char_type(ch);
    const bool terminalOk = !traits_type::eq_int_type(m_terminal->sputc(value), traits_type::eof());
    const bool fileOk = !traits_type::eq_int_type(m_file->sputc(value), traits_type::eof());
    return (terminalOk && fileOk) ? ch : traits_type::eof();
  }

  std::streamsize xsputn(const char* data, std::streamsize size) override
  {
    std::lock_guard<std::mutex> lock(m_outputMutex);
    const std::streamsize terminalCount = m_terminal->sputn(data, size);
    const std::streamsize fileCount = m_file->sputn(data, size);
    return std::min(terminalCount, fileCount);
  }

  int sync() override
  {
    std::lock_guard<std::mutex> lock(m_outputMutex);
    return (m_terminal->pubsync() == 0 && m_file->pubsync() == 0) ? 0 : -1;
  }

private:
  std::streambuf* m_terminal;
  std::streambuf* m_file;
  std::mutex& m_outputMutex;
};

std::string getString(const std::string& json, const std::string& key)
{
  const std::string marker = "\"" + key + "\":\"";
  const std::size_t start = json.find(marker);
  if (start == std::string::npos) return std::string();
  const std::size_t valueStart = start + marker.size();
  const std::size_t valueEnd = json.find('"', valueStart);
  return valueEnd == std::string::npos ? std::string() : json.substr(valueStart, valueEnd - valueStart);
}

long getNumber(const std::string& json, const std::string& key, long fallback = 0)
{
  const std::string marker = "\"" + key + "\":";
  const std::size_t start = json.find(marker);
  if (start == std::string::npos) return fallback;
  const char* value = json.c_str() + start + marker.size();
  char* end = NULL;
  const long result = std::strtol(value, &end, 10);
  return end == value ? fallback : result;
}

double getReal(const std::string& json, const std::string& key, double fallback = 0.0)
{
  const std::string marker = "\"" + key + "\":";
  const std::size_t start = json.find(marker);
  if (start == std::string::npos) return fallback;
  const char* value = json.c_str() + start + marker.size();
  char* end = NULL;
  const double result = std::strtod(value, &end);
  return end == value ? fallback : result;
}

std::vector<long> getArray(const std::string& json, const std::string& key)
{
  const std::string marker = "\"" + key + "\":";
  const std::size_t start = json.find(marker);
  if (start == std::string::npos) return std::vector<long>();
  const std::size_t open = json.find('[', start + marker.size());
  if (open == std::string::npos) return std::vector<long>();
  const std::size_t close = json.find(']', open + 1);
  if (close == std::string::npos) return std::vector<long>();

  std::vector<long> values;
  const char* cursor = json.c_str() + open + 1;
  const char* finish = json.c_str() + close;
  while (cursor < finish)
  {
    while (cursor < finish && (*cursor == ' ' || *cursor == ',')) ++cursor;
    if (cursor == finish) break;
    char* end = NULL;
    const long value = std::strtol(cursor, &end, 10);
    if (end == cursor) break;
    values.push_back(value);
    cursor = end;
  }
  return values;
}

void printMatrix(std::ostream& output, const char* label,
                 const std::vector<long>& values, int width, int height)
{
  if (width <= 0 || height <= 0 || values.size() < static_cast<std::size_t>(width * height)) return;
  output << "  " << label << " (" << width << "x" << height << ")\n";
  for (int y = 0; y < height; ++y)
  {
    output << "    ";
    for (int x = 0; x < width; ++x)
    {
      output.width(5);
      output << values[y * width + x] << (x + 1 == width ? '\n' : ' ');
    }
  }
}

void printTraceEvent(const std::string& json)
{
  std::ostringstream formatted;
  const std::string event = getString(json, "event");
  if (event == "INTRA_REF_SAMPLES")
  {
    const int size = static_cast<int>(getNumber(json, "pu_size"));
    formatted << "\n[HM function] TEncSearch::estIntraPredLumaQT()\n"
              << "  Trace site: intra reference samples initialized, before mode search.\n"
              << "  PU=" << size << "x" << size
              << " at (" << getNumber(json, "pu_x") << ',' << getNumber(json, "pu_y")
              << ") POC=" << getNumber(json, "poc") << '\n';
    const std::vector<long> top = getArray(json, "ref_unfilt_top");
    const std::vector<long> left = getArray(json, "ref_unfilt_left");
    printMatrix(formatted, "Unfiltered top references", top, static_cast<int>(top.size()), 1);
    printMatrix(formatted, "Unfiltered left references", left, static_cast<int>(left.size()), 1);
  }
  else if (event == "INTRA_FAST_MODE")
  {
    const int size = static_cast<int>(getNumber(json, "pu_size"));
    formatted << "\n[HM function] TEncSearch::estIntraPredLumaQT()\n"
              << "  Caller: TEncCu::xCheckRDCostIntra() <- TEncCu::xCompressCU()\n"
              << "  Trace site: first-pass mode pruning after predIntraAng().\n"
              << "  Candidate PU=" << size << "x" << size
              << " at (" << getNumber(json, "pu_x") << ',' << getNumber(json, "pu_y") << ")"
              << " mode=" << getNumber(json, "mode")
              << " fast-cost=" << getReal(json, "fast_cost") << '\n';
    printMatrix(formatted, "Original Y", getArray(json, "org_y"), size, size);
    printMatrix(formatted, "Prediction Y", getArray(json, "pred_y"), size, size);
    printMatrix(formatted, "Residual Y = Original - Prediction", getArray(json, "residual_y"), size, size);
  }
  else if (event == "TRANSFORM_QUANT")
  {
    const int width = static_cast<int>(getNumber(json, "width"));
    const int height = static_cast<int>(getNumber(json, "height"));
    const std::string component = getString(json, "component");
    formatted << "\n[HM function] TComTrQuant::transformNxN()\n"
              << "  Caller path: ";
    if (component == "Y")
    {
      formatted << "TEncSearch::xIntraCodingTUBlock() <- xRecurIntraCodingLumaQT() "
                << "<- estIntraPredLumaQT() <- xCheckRDCostIntra()\n";
    }
    else
    {
      formatted << "TEncSearch::xIntraCodingTUBlock() <- estIntraPredChromaQT() "
                << "<- xCheckRDCostIntra()\n";
    }
    formatted << "  Trace site: transform and quantization completed for TU.\n"
              << "  Owner CU=" << getNumber(json, "cu_x") << ',' << getNumber(json, "cu_y")
              << ' ' << getNumber(json, "cu_width") << 'x' << getNumber(json, "cu_height")
              << " depth=" << getNumber(json, "cu_depth")
              << " pred=" << getString(json, "pred_mode")
              << " mode=" << getNumber(json, "intra_mode") << '\n'
              << "  TU=" << getNumber(json, "tu_x") << ','
              << getNumber(json, "tu_y") << ' ' << width << 'x' << height
              << " depth=" << getNumber(json, "tu_depth")
              << " component=" << component
              << " QP=" << getNumber(json, "qp") << '\n';
    printMatrix(formatted, "Residual input", getArray(json, "residual"), width, height);
    printMatrix(formatted, "Transform coefficients", getArray(json, "transform_coeff"), width, height);
    printMatrix(formatted, "Quantized coefficients", getArray(json, "quant_coeff"), width, height);
  }
  else if (event == "CTU_PARTITION")
  {
    formatted << "\n[HM function] TEncCu::compressCtu() -> dumpPartitionTree()\n"
              << "  Trace site: xCompressCU() returned; final selected tree for CTU ("
              << getNumber(json, "ctu_x") << ',' << getNumber(json, "ctu_y") << ").\n";
    formatted << "  Partition nodes (JSON): " << json << '\n';
  }
  const std::string output = formatted.str();
  if (!output.empty())
  {
    std::cout << output;
  }
}

void streamTrace(const std::string& path, std::atomic<bool>& readerReady,
                 const std::atomic<bool>& encodeFinished, std::mutex& outputMutex)
{
  std::ifstream trace;
  while (!trace.is_open())
  {
    trace.clear();
    trace.open(path.c_str(), std::ios::in | std::ios::binary);
    if (!trace.is_open()) std::this_thread::sleep_for(std::chrono::milliseconds(5));
  }
  readerReady.store(true);

  std::streamoff offset = 0;
  std::string pending;
  while (true)
  {
    trace.clear();
    trace.seekg(offset);
    char buffer[8192];
    trace.read(buffer, sizeof(buffer));
    const std::streamsize count = trace.gcount();
    if (count > 0)
    {
      offset += count;
      pending.append(buffer, static_cast<std::size_t>(count));
      std::size_t newline = std::string::npos;
      while ((newline = pending.find('\n')) != std::string::npos)
      {
        const std::string line = pending.substr(0, newline);
        pending.erase(0, newline + 1);
        std::lock_guard<std::mutex> lock(outputMutex);
        printTraceEvent(line);
        std::cout.flush();
      }
    }
    else if (encodeFinished.load())
    {
      if (!pending.empty())
      {
        std::lock_guard<std::mutex> lock(outputMutex);
        printTraceEvent(pending);
        std::cout.flush();
      }
      break;
    }
    else
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }
  }
}
}

int main(int argc, char* argv[])
{
  TAppEncTop app;
  app.create();

  try
  {
    if (!app.parseCfg(argc, argv))
    {
      app.destroy();
      return 1;
    }
  }
  catch (df::program_options_lite::ParseFailure& e)
  {
    std::cerr << "Error parsing option \"" << e.arg
              << "\" with argument \"" << e.val << "\".\n";
    app.destroy();
    return 1;
  }

  const char* outputDir = std::getenv("VISUAL_OUTPUT_DIR");
  const std::string tracePath =
      (outputDir && *outputDir) ? std::string(outputDir) + "/trace.jsonl"
                                : "dump_data/trace.jsonl";
  const std::string traceDir = (outputDir && *outputDir) ? outputDir : "dump_data";
  std::error_code directoryError;
  std::filesystem::create_directories(traceDir, directoryError);
  if (directoryError)
  {
    std::cerr << "Cannot create trace directory: " << traceDir << '\n';
    app.destroy();
    return 1;
  }
  { std::ofstream traceBootstrap(tracePath.c_str(), std::ios::out | std::ios::trunc);
    if (!traceBootstrap)
    {
      std::cerr << "Cannot create trace file: " << tracePath << '\n';
      app.destroy();
      return 1;
    }
  }

  const char* configuredLogPath = std::getenv("INTRA_PROBE_LOG");
  const std::string logPath = (configuredLogPath && *configuredLogPath)
                                ? configuredLogPath
                                : "tools/intra_probe_run.log";
  std::ofstream runLog(logPath.c_str(), std::ios::out | std::ios::trunc);
  if (!runLog)
  {
    std::cerr << "Cannot open probe log: " << logPath << '\n';
    app.destroy();
    return 1;
  }
  std::mutex teeMutex;
  TeeBuffer teeOut(std::cout.rdbuf(), runLog.rdbuf(), teeMutex);
  TeeBuffer teeErr(std::cerr.rdbuf(), runLog.rdbuf(), teeMutex);
  std::streambuf* const originalCout = std::cout.rdbuf(&teeOut);
  std::streambuf* const originalCerr = std::cerr.rdbuf(&teeErr);
  std::cout << "[Log policy] Terminal output is mirrored to " << logPath
            << " (overwritten on the next run).\n";

  std::atomic<bool> readerReady(false);
  std::atomic<bool> encodeFinished(false);
  std::mutex outputMutex;
  std::thread traceThread(streamTrace, tracePath, std::ref(readerReady),
                          std::cref(encodeFinished), std::ref(outputMutex));
  while (!readerReady.load()) std::this_thread::sleep_for(std::chrono::milliseconds(1));

  std::cout << "\n[HM call flow]\n"
            << "  TAppEncTop::encode()\n"
            << "    -> TEncTop::encode() / TEncGOP::compressGOP() / TEncSlice::compressSlice()\n"
            << "      -> TEncCu::compressCtu() -> TEncCu::xCompressCU()\n"
            << "        -> TEncCu::xCheckRDCostIntra() [when intra conditions pass]\n"
            << "          -> TEncSearch::estIntraPredLumaQT()\n"
            << "            -> xRecurIntraCodingLumaQT() -> xIntraCodingTUBlock()\n"
            << "              -> TComTrQuant::transformNxN()\n"
            << "Event labels identify the HM trace hook that emitted each record.\n";

  const std::chrono::steady_clock::time_point start = std::chrono::steady_clock::now();
  bool encodeSucceeded = true;
  try
  {
    app.encode();
  }
  catch (const std::exception& error)
  {
    std::cerr << "Probe encode failed: " << error.what() << '\n';
    encodeSucceeded = false;
  }
  catch (...)
  {
    std::cerr << "Probe encode failed with an unknown exception.\n";
    encodeSucceeded = false;
  }
  encodeFinished.store(true);
  traceThread.join();
  std::cout << "\nProbe encode time: "
            << std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count()
            << " sec.\n";

  app.destroy();
  std::cout.flush();
  std::cerr.flush();
  std::cout.rdbuf(originalCout);
  std::cerr.rdbuf(originalCerr);
  runLog.close();
  return encodeSucceeded ? 0 : 1;
}

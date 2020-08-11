const source = `
// Author: Backl1ght
#include <iostream>
#include <vector>
#include <string>
using namespace std;

namespace DEBUG {
template <typename T>
inline void _debug(const char* format, T t) {
  cerr << format << '=' << t << endl;
}

template <class First, class... Rest>
inline void _debug(const char* format, First first, Rest... rest) {
  while (*format != ',') cerr << *format++;
  cerr << '=' << first << ",";
  _debug(format + 1, rest...);
}

template <typename T>
ostream& operator<<(ostream& os, vector<T> V) {
  os << "[ ";
  for (auto vv : V) os << vv << ", ";
  os << "]";
  return os;
}

#define debug(...) _debug(#__VA_ARGS__, __VA_ARGS__)
}  // namespace DEBUG
using namespace DEBUG;

int main(int argc, char* argv[]) {
  int a = 666;
  vector<int> b({1, 2, 3});
  string c = "hello world";

  // before
  cout << "a=" << a << ", b=" << b << ", c=" << c
       << endl;  // a=666, b=[ 1, 2, 3, ], c=hello world
  // 如果用printf的话，在只有基本数据类型的时候是比较方便的，然是如果要输出vector等的内容的话，就会比较麻烦

  // after
  debug(a, b, c);  // a=666, b=[ 1, 2, 3, ], c=hello world

  return 0;
}
`

import { getHighlighter } from '../index'
import * as fs from 'fs'

const f = async () => {
  const highlighter = await getHighlighter({
    theme: 'light_plus'
  })
  const res = await highlighter.codeToThemedTokens(source, 'cpp')
  const html = await highlighter.codeToHtml(source, 'cpp')
  fs.writeFileSync('./qwq.html', html)
  // console.log(JSON.stringify(res, null, 2))
}

f()

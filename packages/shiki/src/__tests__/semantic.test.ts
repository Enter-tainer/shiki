const source = `
#include <algorithm>
#include <memory>
#include <vector>
template <class Key, class Compare = std::less<Key>>
class Set {
 private:
  enum NodeColor { kBlack = 0, kRed = 1 };

  struct Node {
    Key key;
    Node *lc{nullptr}, *rc{nullptr};
    size_t size{0};
    NodeColor color;  // the color of the parent link

    Node(Key key, NodeColor color, size_t size)
        : key(key), color(color), size(size) {}

    Node() = default;
  };

  void destroyTree(Node *root) const {
    if (root != nullptr) {
      destroyTree(root->lc);
      destroyTree(root->rc);
      root->lc = root->rc = nullptr;
      delete root;
    }
  }

  bool is_red(const Node *nd) const {
    return nd == nullptr ? false : nd->color;  // kRed == 1, kBlack == 0
  }

  size_t size(const Node *nd) const { return nd == nullptr ? 0 : nd->size; }

  Node *rotate_left(Node *node) const {
    // left rotate a red link
    Node *res = node->rc;
    node->rc = res->lc;
    res->lc = node;
    res->color = node->color;
    node->color = kRed;
    res->size = node->size;
    node->size = size(node->lc) + size(node->rc) + 1;
    return res;
  }

  Node *rotate_right(Node *node) const {
    // right rotate a red link
    Node *res = node->lc;
    node->lc = res->rc;
    res->rc = node;
    res->color = node->color;
    node->color = kRed;
    res->size = node->size;
    node->size = size(node->lc) + size(node->rc) + 1;
    return res;
  }

  NodeColor neg_color(NodeColor n) const { return n == kBlack ? kRed : kBlack; }

  void color_flip(Node *node) const {
    node->color = neg_color(node->color);
    node->lc->color = neg_color(node->lc->color);
    node->rc->color = neg_color(node->rc->color);
  }

  Node *insert(Node *root, const Key &key) const;
  Node *delete_arbitrary(Node *root, Key key) const;
  Node *delete_min(Node *root) const;
  Node *move_red_right(Node *root) const;
  Node *move_red_left(Node *root) const;
  Node *fix_up(Node *root) const;
  const Key &get_min(Node *root) const;
  void serialize(Node *root, std::vector<Key> *) const;
  void print_tree(Set::Node *root, int indent) const;
  Compare cmp_ = Compare();
  Node *root_{nullptr};

 public:
  typedef Key KeyType;
  typedef Key ValueType;
  typedef std::size_t SizeType;
  typedef std::ptrdiff_t DifferenceType;
  typedef Compare KeyCompare;
  typedef Compare ValueCompare;
  typedef Key &Reference;
  typedef const Key &ConstReference;

  Set() = default;

  Set(Set &) = default;

  Set(Set &&) noexcept = default;

  ~Set() { destroyTree(root_); }

  SizeType size() const;

  SizeType count(const KeyType &key) const;

  SizeType erase(const KeyType &key);

  void clear();

  void insert(const KeyType &key);

  bool empty() const;

  std::vector<Key> serialize() const;

  void print_tree() const;
};

template <class Key, class Compare>
typename Set<Key, Compare>::SizeType Set<Key, Compare>::count(
    ConstReference key) const {
  Node *x = root_;
  while (x != nullptr) {
    if (key == x->key) return 1;
    if (cmp_(key, x->key))  // if (key < x->key)
      x = x->lc;
    else
      x = x->rc;
  }
  return 0;
}

template <class Key, class Compare>
typename Set<Key, Compare>::SizeType Set<Key, Compare>::erase(
    const KeyType &key) {
  if (count(key) > 0) {
    if (!is_red(root_->lc) && !(is_red(root_->rc))) root_->color = kRed;
    root_ = delete_arbitrary(root_, key);
    if (root_ != nullptr) root_->color = kBlack;
    return 1;
  } else {
    return 0;
  }
}

template <class Key, class Compare>
void Set<Key, Compare>::clear() {
  destroyTree(root_);
  root_ = nullptr;
}

template <class Key, class Compare>
void Set<Key, Compare>::insert(const KeyType &key) {
  root_ = insert(root_, key);
  root_->color = kBlack;
}

template <class Key, class Compare>
bool Set<Key, Compare>::empty() const {
  return size(root_) == 0;
}

template <class Key, class Compare>
typename Set<Key, Compare>::Node *Set<Key, Compare>::insert(
    Set::Node *root, const Key &key) const {
  if (root == nullptr) return new Node(key, kRed, 1);
  if (root->key == key)
    ;
  else if (cmp_(key, root->key))  // if (key < root->key)
    root->lc = insert(root->lc, key);
  else
    root->rc = insert(root->rc, key);
  return fix_up(root);
}

template <class Key, class Compare>
typename Set<Key, Compare>::Node *Set<Key, Compare>::delete_min(
    Set::Node *root) const {
  if (root->lc == nullptr) {
    delete root;
    return nullptr;
  }
  if (!is_red(root->lc) && !is_red(root->lc->lc)) {
    // make sure either root->lc or root->lc->lc is red
    // thus make sure we will delete a red node in the end
    root = move_red_left(root);
  }
  root->lc = delete_min(root->lc);
  return fix_up(root);
}

template <class Key, class Compare>
typename Set<Key, Compare>::Node *Set<Key, Compare>::move_red_right(
    Set::Node *root) const {
  color_flip(root);
  if (is_red(root->lc->lc)) {  // assume that root->lc != nullptr when calling
                               // this function
    root = rotate_right(root);
    color_flip(root);
  }
  return root;
}

template <class Key, class Compare>
typename Set<Key, Compare>::Node *Set<Key, Compare>::move_red_left(
    Set::Node *root) const {
  color_flip(root);
  if (is_red(root->rc->lc)) {
    // assume that root->rc != nullptr when calling this function
    root->rc = rotate_right(root->rc);
    root = rotate_left(root);
    color_flip(root);
  }
  return root;
}

template <class Key, class Compare>
typename Set<Key, Compare>::Node *Set<Key, Compare>::fix_up(
    Set::Node *root) const {
  if (is_red(root->rc) && !is_red(root->lc))  // fix right leaned red link
    root = rotate_left(root);
  if (is_red(root->lc) &&
      is_red(root->lc->lc))  // fix doubly linked left leaned red link
    // if (root->lc == nullptr), then the second expr won't be evaluated
    root = rotate_right(root);
  if (is_red(root->lc) && is_red(root->rc))
    // break up 4 node
    color_flip(root);
  root->size = size(root->lc) + size(root->rc) + 1;
  return root;
}

template <class Key, class Compare>
const Key &Set<Key, Compare>::get_min(Set::Node *root) const {
  Node *x = root;
  // will crash as intended when root == nullptr
  for (; x->lc != nullptr; x = x->lc)
    ;
  return x->key;
}

template <class Key, class Compare>
typename Set<Key, Compare>::SizeType Set<Key, Compare>::size() const {
  return size(root_);
}

template <class Key, class Compare>
typename Set<Key, Compare>::Node *Set<Key, Compare>::delete_arbitrary(
    Set::Node *root, Key key) const {
  if (cmp_(key, root->key)) {
    // key < root->key
    if (!is_red(root->lc) && !(is_red(root->lc->lc)))
      root = move_red_left(root);
    // ensure the invariant: either root->lc or root->lc->lc (or root and
    // root->lc after dive into the function) is red, to ensure we will
    // eventually delete a red node. therefore we will not break the black
    // height balance
    root->lc = delete_arbitrary(root->lc, key);
  } else {
    // key >= root->key
    if (is_red(root->lc)) root = rotate_right(root);
    if (key == root->key && root->rc == nullptr) {
      delete root;
      return nullptr;
    }
    if (!is_red(root->rc) && !is_red(root->rc->lc)) root = move_red_right(root);
    if (key == root->key) {
      root->key = get_min(root->rc);
      root->rc = delete_min(root->rc);
    } else {
      root->rc = delete_arbitrary(root->rc, key);
    }
  }
  return fix_up(root);
}

template <class Key, class Compare>
std::vector<Key> Set<Key, Compare>::serialize() const {
  std::vector<int> v;
  serialize(root_, &v);
  return v;
}

template <class Key, class Compare>
void Set<Key, Compare>::serialize(Set::Node *root,
                                  std::vector<Key> *res) const {
  if (root == nullptr) return;
  serialize(root->lc, res);
  res->push_back(root->key);
  serialize(root->rc, res);
}

template <class Key, class Compare>
void Set<Key, Compare>::print_tree(Set::Node *root, int indent) const {
  if (root == nullptr) return;
  print_tree(root->lc, indent + 4);
  std::cout << std::string(indent, '-') << root->key << std::endl;
  print_tree(root->rc, indent + 4);
}

template <class Key, class Compare>
void Set<Key, Compare>::print_tree() const {
  print_tree(root_, 0);
}

const int a;
Set<int> s;
int main () {
  s;
}
/* 「LOJ #6053」简单的函数 */
#include <algorithm>
#include <cmath>
#include <cstdio>

using i64 = long long;

constexpr int maxs = 200000;  // 2sqrt(n)
constexpr int mod = 1000000007;

template <typename x_t, typename y_t>
inline void inc(x_t &x, const y_t &y) {
  x += y;
  (mod <= x) && (x -= mod);
}
template <typename x_t, typename y_t>
inline void dec(x_t &x, const y_t &y) {
  x -= y;
  (x < 0) && (x += mod);
}
template <typename x_t, typename y_t>
inline int sum(const x_t &x, const y_t &y) {
  return x + y < mod ? x + y : (x + y - mod);
}
template <typename x_t, typename y_t>
inline int sub(const x_t &x, const y_t &y) {
  return x < y ? x - y + mod : (x - y);
}
template <typename _Tp>
inline int div2(const _Tp &x) {
  return ((x & 1) ? x + mod : x) >> 1;
}
template <typename _Tp>
inline i64 sqrll(const _Tp &x) {
  return (i64)x * x;
}

int pri[maxs / 7], lpf[maxs + 1], spri[maxs + 1], pcnt;

inline void sieve(const int &n) {
  for (int i = 2; i <= n; ++i) {
    if (lpf[i] == 0)
      pri[lpf[i] = ++pcnt] = i, spri[pcnt] = sum(spri[pcnt - 1], i);
    for (int j = 1, v; j <= lpf[i] && (v = i * pri[j]) <= n; ++j) lpf[v] = j;
  }
}

i64 global_n;
int lim;
int le[maxs + 1],  // x \le \sqrt{n}
    ge[maxs + 1];  // x > \sqrt{n}
#define idx(v) (v <= lim ? le[v] : ge[global_n / v])

int G[maxs + 1][2], Fprime[maxs + 1];
i64 lis[maxs + 1];
int cnt;

inline void init(const i64 &n) {
  for (i64 i = 1, j, v; i <= n; i = n / j + 1) {
    j = n / i;
    v = j % mod;
    lis[++cnt] = j;
    idx(j) = cnt;
    G[cnt][0] = sub(v, 1ll);
    G[cnt][1] = div2((i64)(v + 2ll) * (v - 1ll) % mod);
  }
}

inline void calcFprime() {
  for (int k = 1; k <= pcnt; ++k) {
    const int p = pri[k];
    const i64 sqrp = sqrll(p);
    for (int i = 1; lis[i] >= sqrp; ++i) {
      const i64 v = lis[i] / p;
      const int id = idx(v);
      dec(G[i][0], sub(G[id][0], k - 1));
      dec(G[i][1], (i64)p * sub(G[id][1], spri[k - 1]) % mod);
    }
  }
  /* F_prime = G_1 - G_0 */
  for (int i = 1; i <= cnt; ++i) Fprime[i] = sub(G[i][1], G[i][0]);
}

inline int f_p(const int &p, const int &c) {
  /* f(p^{c}) = p xor c */
  return p xor c;
}

int F(const int &k, const i64 &n) {
  if (n < pri[k] || n <= 1) return 0;
  const int id = idx(n);
  i64 ans = Fprime[id] - (spri[k - 1] - (k - 1));
  if (k == 1) ans += 2;
  for (int i = k; i <= pcnt && sqrll(pri[i]) <= n; ++i) {
    i64 pw = pri[i], pw2 = sqrll(pw);
    for (int c = 1; pw2 <= n; ++c, pw = pw2, pw2 *= pri[i])
      ans +=
          ((i64)f_p(pri[i], c) * F(i + 1, n / pw) + f_p(pri[i], c + 1)) % mod;
  }
  return ans % mod;
}

int main() {
  scanf("%lld", &global_n);
  lim = sqrt(global_n);

  sieve(lim + 1000);
  init(global_n);
  calcFprime();
  printf("%lld\n", (F(1, global_n) + 1ll + mod) % mod);

  return 0;
}
`

import { getHighlighter } from '../index'
import * as fs from 'fs'

const f = async () => {
  const highlighter = await getHighlighter({
    theme: 'dark_plus'
  })
  // const res = await highlighter.codeToThemedTokens(source, 'cpp')
  const html = await highlighter.codeToHtml(source, 'cpp', true)
  fs.writeFileSync('./qwq.html', html)
  // console.log(JSON.stringify(res, null, 2))
}

f()

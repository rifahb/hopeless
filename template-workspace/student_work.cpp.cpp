// Student C++ Exercise
// Debug the factorial function

#include <iostream>
using namespace std;

int factorial(int n) {
        // TODO: Fix this function
            if (n <= 1) {
                        return 1;
            }
                return n * factorial(n - 1);
}

int main() {
        int number = 5;
            cout << "Factorial of " << number << " is: " << factorial(number) << endl;
                
                    // Test with different values
                        for (int i = 1; i <= 10; i++) {
                                    cout << "factorial(" << i << ") = " << factorial(i) << endl;
                        }
                            
                                return 0;
}
                        }
}
            }
}
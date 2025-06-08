// Student JavaScript Exercise
// Fix the prime number checker function

function isPrime(num) {
        if (num <= 1) return false;
            
                for (let i = 2; i < num; i++) {
                            if (num % i === 0) {
                                            return false;
                            }
                }
                    return true;
}

// Test the function
console.log("isPrime(7):", isPrime(7));
console.log("isPrime(4):", isPrime(4));
                            }
                }
}
// Test file for AutoDocs - NO COMMENTS

function calculateSum(a: number, b: number): number {
    return a + b;
}

function multiplyNumbers(x: number, y: number): number {
    return x * y;
}

async function fetchUserData(userId: string) {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
}

class UserService {
    private users: Map<string, any> = new Map();

    addUser(id: string, data: any): void {
        this.users.set(id, data);
    }

    getUser(id: string): any {
        return this.users.get(id);
    }

    deleteUser(id: string): boolean {
        return this.users.delete(id);
    }
}

const processData = (data: any[]) => {
    return data.filter(item => item.active).map(item => item.name);
};

export { calculateSum, multiplyNumbers, fetchUserData, UserService, processData };
